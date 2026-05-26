$(document).ready(function() {
    // Theme Switcher Logic
    let currentTheme = localStorage.getItem("theme") || "dark";
    applyTheme(currentTheme);

    $("#themeToggle").click(function() {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("theme", currentTheme);
        applyTheme(currentTheme);
    });

    function applyTheme(theme) {
        if (theme === "light") {
            $("html").removeClass("dark");
        } else {
            $("html").addClass("dark");
        }
    }

    // 1. Kiểm tra session đăng nhập
    const manv = localStorage.getItem("manv");
    const hoten = localStorage.getItem("hoten");
    const maquyen = localStorage.getItem("maquyen");
    const token = localStorage.getItem("token");

    if (!manv || !token || parseInt(maquyen) !== 3) {
        // Nếu không phải Thu ngân hoặc chưa đăng nhập -> Về trang Login
        handleLogout();
        return;
    }

    $("#cashierName").text(hoten);

    // Biến trạng thái tab
    let activeTab = 'pending'; // 'pending' hoặc 'history'
    let pendingOrders = [];
    let completedOrders = []; // Chỉ lọc lưu các đơn của ngày hôm nay
    let selectedOrder = null;
    let selectedOrderDetails = [];
    let pollInterval = null;
    let sessionCheckInterval = null;

    // Helper kiểm tra màn hình tối để tạo popup đẹp phù hợp
    function getSwalBg() {
        return $("html").hasClass("dark") ? '#0f172a' : '#ffffff';
    }
    function getSwalColor() {
        return $("html").hasClass("dark") ? '#f1f5f9' : '#0f172a';
    }

    // 2. Chạy đồng hồ thời gian thực
    function updateClock() {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const dateStr = now.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        $("#liveClock").text(timeStr);
        $("#liveDate").text(dateStr);
    }
    updateClock();
    setInterval(updateClock, 1000);

    // 3. Kiểm tra session định kỳ
    function checkUserSession() {
        $.ajax({
            url: CONFIG.BASE_URL + "api/check_session.php",
            type: "POST",
            data: { manv: manv, token: token },
            dataType: "json",
            success: function(res) {
                if (res.status !== "success") {
                    clearInterval(pollInterval);
                    clearInterval(sessionCheckInterval);
                    Swal.fire({
                        icon: 'warning',
                        title: 'Phiên làm việc hết hạn',
                        text: 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác!',
                        allowOutsideClick: false,
                        background: getSwalBg(),
                        color: getSwalColor(),
                        confirmButtonText: 'Đăng nhập lại'
                    }).then(() => {
                        handleLogout();
                    });
                }
            }
        });
    }
    sessionCheckInterval = setInterval(checkUserSession, 10000);

    // 4. Tab toggles
    $("#tabPending").click(function() {
        if (activeTab === 'pending') return;
        activeTab = 'pending';
        clearDetailsPanel();

        // Cập nhật tab style
        $("#tabPending").addClass("border-gold text-gold font-bold").removeClass("border-transparent text-slate-500");
        $("#tabHistory").removeClass("border-gold text-gold font-bold").addClass("border-transparent text-slate-500");
        
        // Cập nhật tiêu đề & ẩn thống kê lịch sử
        $("#queueTitle").html(`<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span>Đơn Chờ Thanh Toán</span>`);
        $("#historyStats").addClass("hidden");

        fetchOrders();
    });

    $("#tabHistory").click(function() {
        if (activeTab === 'history') return;
        activeTab = 'history';
        clearDetailsPanel();

        // Cập nhật tab style
        $("#tabHistory").addClass("border-gold text-gold font-bold").removeClass("border-transparent text-slate-500");
        $("#tabPending").removeClass("border-gold text-gold font-bold").addClass("border-transparent text-slate-500");

        // Cập nhật tiêu đề & hiện thống kê lịch sử
        $("#queueTitle").html(`<span class="w-2.5 h-2.5 rounded-full bg-gold animate-pulse"></span><span>Lịch Sử Đã Duyệt</span>`);
        $("#historyStats").removeClass("hidden");

        fetchOrders();
    });

    // 5. Tải danh sách đơn hàng tùy theo tab
    function fetchOrders() {
        if (activeTab === 'pending') {
            $.ajax({
                url: CONFIG.BASE_URL + "api/get_pending_orders.php",
                type: "GET",
                dataType: "json",
                success: function(data) {
                    if (data.status === "error") return;
                    pendingOrders = data;
                    renderOrderQueue();
                }
            });
        } else {
            $.ajax({
                url: CONFIG.BASE_URL + "api/get_paid_orders.php",
                type: "GET",
                dataType: "json",
                success: function(data) {
                    if (data.status === "error") return;
                    
                    // Lọc lấy các đơn của ngày hôm nay (YYYY-MM-DD) tương tự trên App Android
                    const localDate = new Date();
                    const year = localDate.getFullYear();
                    const month = String(localDate.getMonth() + 1).padStart(2, '0');
                    const day = String(localDate.getDate()).padStart(2, '0');
                    const todayStr = `${year}-${month}-${day}`;

                    completedOrders = data.filter(o => o.NGAYDAT && o.NGAYDAT.startsWith(todayStr));
                    
                    calculateHistorySums();
                    renderOrderQueue();
                }
            });
        }
    }
    fetchOrders();

    // Kết nối WebSocket Socket.io thay thế Polling
    function initWebSocket() {
        let socketUrl = window.location.origin;
        if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            socketUrl = 'http://103.157.204.120';
        }
        
        console.log('Connecting to WebSocket at:', socketUrl);
        const socket = io(socketUrl, {
            path: '/socket.io/'
        });

        socket.on('connect', () => {
            console.log('🔌 Cashier WebSocket connected!');
            socket.emit('join_cashier'); // Đăng ký vào room thu ngân
        });

        socket.on('refresh_orders', () => {
            console.log('📢 Refreshing order list via WebSocket');
            fetchOrders();
        });

        socket.on('disconnect', () => {
            console.log('❌ Cashier WebSocket disconnected. Auto-reconnecting...');
        });
    }
    initWebSocket();

    // Tính tổng tiền mặt, chuyển khoản và tổng cộng trong ngày
    function calculateHistorySums() {
        let cashSum = 0;
        let transferSum = 0;

        completedOrders.forEach(o => {
            const total = parseFloat(o.TONGTIEN) || 0;
            if (o.PHUONGTHUCTT === 'Chuyển khoản') {
                transferSum += total;
            } else {
                cashSum += total;
            }
        });

        $("#sumCash").text(formatMoney(cashSum));
        $("#sumTransfer").text(formatMoney(transferSum));
        $("#sumTotal").text(formatMoney(cashSum + transferSum));
    }

    // 6. Render danh sách đơn lên cột trái
    function renderOrderQueue() {
        const searchTerm = $("#searchBar").val().trim().toLowerCase();
        const activeList = activeTab === 'pending' ? pendingOrders : completedOrders;

        const filtered = activeList.filter(o => 
            o.TENBAN.toLowerCase().includes(searchTerm) || 
            o.MADONDAT.toString().includes(searchTerm)
        );

        $("#queueCount").text(filtered.length + " đơn");

        if (filtered.length === 0) {
            $("#orderQueueList").html(`
                <div class="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
                    <i class="fa-solid fa-inbox text-4xl mb-3 text-slate-350 dark:text-slate-750"></i>
                    <p class="text-sm">${activeTab === 'pending' ? 'Không có đơn chờ thanh toán' : 'Chưa có đơn đã duyệt hôm nay'}</p>
                </div>
            `);
            return;
        }

        let html = '';
        filtered.forEach(o => {
            const isSelected = selectedOrder && selectedOrder.MADONDAT === o.MADONDAT;
            const methodBg = o.PHUONGTHUCTT === 'Chuyển khoản' 
                ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

            const timeStr = o.NGAYDAT.split(' ')[1].substring(0, 5); // HH:MM

            html += `
                <div data-id="${o.MADONDAT}" 
                     class="animated-card glass-card p-4 rounded-2xl cursor-pointer bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-gold/50 dark:hover:border-gold/30 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:shadow-md transition-all flex items-center justify-between ${isSelected ? 'active-card shadow-lg shadow-gold/5 border-gold dark:border-gold' : ''}">
                    <div class="space-y-1">
                        <div class="flex items-center space-x-2">
                            <span class="font-extrabold text-slate-900 dark:text-white text-base">${o.TENBAN}</span>
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${methodBg}">${o.PHUONGTHUCTT}</span>
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">
                            <span>Mã đơn: #${o.MADONDAT}</span> &bull; 
                            <span>Phục vụ: ${o.HOTENNV}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-extrabold text-gold text-base">${formatMoney(o.TONGTIEN)}</div>
                        <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${timeStr}</div>
                    </div>
                </div>
            `;
        });
        $("#orderQueueList").html(html);

        // Click chọn đơn hàng
        $("#orderQueueList > div").click(function() {
            const orderId = $(this).data("id");
            const list = activeTab === 'pending' ? pendingOrders : completedOrders;
            const orderObj = list.find(o => o.MADONDAT == orderId);
            if (orderObj) {
                selectOrder(orderObj);
            }
        });
    }

    // Gõ tìm kiếm lọc danh sách ngay lập tức
    $("#searchBar").on("input", renderOrderQueue);

    // 7. Chọn đơn hàng và xem chi tiết
    function selectOrder(order) {
        selectedOrder = order;
        renderOrderQueue(); // Update active border styling

        // Hiển thị loading chi tiết
        $("#detailsEmptyState").addClass("hidden");
        $("#detailsContent").removeClass("opacity-0 pointer-events-none").addClass("opacity-100");
        $("#detailTableName").text(order.TENBAN);
        $("#detailOrderID").text(order.MADONDAT);
        $("#detailWaiterName").text(order.HOTENNV);
        $("#detailTime").html(`<i class="fa-regular fa-calendar mr-1"></i>${order.NGAYDAT}`);

        const methodBg = order.PHUONGTHUCTT === 'Chuyển khoản' 
            ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20' 
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
        $("#detailPayMethod").text(order.PHUONGTHUCTT).attr("class", `text-xs font-bold px-2.5 py-0.5 rounded-full border ${methodBg}`);

        $("#detailGrandTotal").text(formatMoney(order.TONGTIEN));
        $("#detailSubtotal").text(formatMoney(order.TONGTIEN));

        // Phân quyền giao diện nút nhấn dựa trên trạng thái thanh toán của đơn
        if (order.TINHTRANG === 'true') {
            $("#pendingActions").addClass("hidden");
            $("#completedActions").removeClass("hidden");
        } else {
            $("#pendingActions").removeClass("hidden");
            $("#completedActions").addClass("hidden");
        }

        // Call API lấy chi tiết món ăn
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_order_details.php",
            type: "GET",
            data: { madondat: order.MADONDAT },
            dataType: "json",
            success: function(items) {
                selectedOrderDetails = items;
                renderOrderItems(items);
            }
        });
    }

    // Render danh sách món ăn chi tiết
    function renderOrderItems(items) {
        if (!items || items.length === 0) {
            $("#detailItemsTableBody").html(`
                <tr>
                    <td colspan="4" class="py-4 text-center text-slate-500">Đơn hàng trống hoặc không có món</td>
                </tr>
            `);
            return;
        }

        let html = '';
        items.forEach(it => {
            const imgUrl = it.HINHANH ? CONFIG.BASE_URL + it.HINHANH : 'images/default_dish.png';
            html += `
                <tr class="border-b border-slate-100 dark:border-slate-900/60 hover:bg-slate-100/40 dark:hover:bg-slate-900/20 transition-colors">
                    <td class="py-3 flex items-center space-x-3">
                        <img class="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-800" src="${imgUrl}" alt="${it.TENMON}" onerror="this.src='https://placehold.co/100x100?text=Food'">
                        <div>
                            <span class="font-semibold text-slate-800 dark:text-slate-100 block text-sm">${it.TENMON}</span>
                            <span class="text-xs text-slate-400 dark:text-slate-550">${formatMoney(it.GIATIEN)}</span>
                        </div>
                    </td>
                    <td class="py-3 text-center font-bold text-slate-700 dark:text-slate-250">${it.SOLUONG}</td>
                    <td class="py-3 text-right text-slate-500 dark:text-slate-455 text-xs">${formatMoney(it.GIATIEN)}</td>
                    <td class="py-3 text-right font-bold text-slate-800 dark:text-slate-100 text-sm">${formatMoney(it.GIATIEN * it.SOLUONG)}</td>
                </tr>
            `;
        });
        $("#detailItemsTableBody").html(html);
    }

    // Clear màn hình chi tiết khi đơn biến mất
    function clearDetailsPanel() {
        selectedOrder = null;
        selectedOrderDetails = [];
        $("#detailsEmptyState").removeClass("hidden");
        $("#detailsContent").addClass("opacity-0 pointer-events-none").removeClass("opacity-100");
    }

    // 7. Xác nhận thanh toán
    $("#btnConfirmPayment").click(function() {
        if (!selectedOrder) return;

        Swal.fire({
            title: 'Xác nhận thanh toán?',
            text: `Thanh toán thành công cho ${selectedOrder.TENBAN} qua ${selectedOrder.PHUONGTHUCTT}. Bàn sẽ được tự động giải phóng!`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý duyệt',
            cancelButtonText: 'Bỏ qua',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                // Hiển thị loading
                Swal.fire({
                    title: 'Đang phê duyệt...',
                    allowOutsideClick: false,
                    background: getSwalBg(),
                    color: getSwalColor(),
                    didOpen: () => { Swal.showLoading(); }
                });

                $.ajax({
                    url: CONFIG.BASE_URL + "api/confirm_payment.php",
                    type: "POST",
                    data: {
                        madondat: selectedOrder.MADONDAT,
                        phuongthuc: selectedOrder.PHUONGTHUCTT
                    },
                    dataType: "json",
                    success: function(response) {
                        Swal.close();
                        if (response.status === "success") {
                            Swal.fire({
                                icon: 'success',
                                title: 'Thanh toán thành công!',
                                text: 'Đơn hàng đã được duyệt và giải phóng bàn thành công.',
                                timer: 1800,
                                background: getSwalBg(),
                                color: getSwalColor(),
                                showConfirmButton: false
                            });
                            clearDetailsPanel();
                            fetchOrders();
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Có lỗi xảy ra',
                                text: response.message || 'Không thể phê duyệt thanh toán.',
                                background: getSwalBg(),
                                color: getSwalColor()
                            });
                        }
                    },
                    error: function() {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Lỗi kết nối',
                            text: 'Mất kết nối tới server. Vui lòng kiểm tra VPS.',
                            background: getSwalBg(),
                            color: getSwalColor()
                        });
                    }
                });
            }
        });
    });

    // 8. In hóa đơn (Thermal ticket layout)
    $("#btnPrintInvoice, #btnPrintInvoiceHistory").click(function() {
        if (!selectedOrder || selectedOrderDetails.length === 0) return;

        // Điền dữ liệu vào form in
        $("#printOrderID").text(selectedOrder.MADONDAT);
        $("#printTableName").text(selectedOrder.TENBAN);
        $("#printDate").text(selectedOrder.NGAYDAT);
        $("#printCashierName").text(hoten);
        $("#printPayMethod").text(selectedOrder.PHUONGTHUCTT);
        $("#printSubtotal").text(formatMoney(selectedOrder.TONGTIEN));
        $("#printGrandTotal").text(formatMoney(selectedOrder.TONGTIEN));

        // Populate items in printed invoice
        let html = '';
        selectedOrderDetails.forEach(it => {
            html += `
                <tr>
                    <td style="padding: 1.5mm 0; font-weight: 600;">${it.TENMON}</td>
                    <td style="text-align: center; padding: 1.5mm 0;">${it.SOLUONG}</td>
                    <td style="text-align: right; padding: 1.5mm 0;">${formatMoney(it.GIATIEN)}</td>
                    <td style="text-align: right; padding: 1.5mm 0; font-weight: 600;">${formatMoney(it.GIATIEN * it.SOLUONG)}</td>
                </tr>
            `;
        });
        $("#printItemsBody").html(html);

        // Trình duyệt in hóa đơn
        window.print();
    });

    // 9. Hủy đơn
    $("#btnCancelOrder").click(function() {
        if (!selectedOrder) return;

        Swal.fire({
            title: 'Hủy đơn hàng này?',
            text: `Bạn đang thực hiện HỦY đơn của ${selectedOrder.TENBAN}. Hành động này không thể hoàn tác!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý hủy',
            cancelButtonText: 'Bỏ qua',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: CONFIG.BASE_URL + "api/delete_table.php",
                    type: "POST",
                    data: { maban: selectedOrder.MABAN },
                    dataType: "json",
                    success: function(response) {
                        if (response.status === "success") {
                            Swal.fire({
                                icon: 'success',
                                title: 'Đã hủy đơn hàng',
                                text: 'Đơn hàng đã được xóa và giải phóng bàn thành công.',
                                timer: 1500,
                                background: getSwalBg(),
                                color: getSwalColor(),
                                showConfirmButton: false
                            });
                            clearDetailsPanel();
                            fetchOrders();
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Thất bại',
                                text: response.message || 'Không thể hủy bàn.',
                                background: getSwalBg(),
                                color: getSwalColor()
                            });
                        }
                    }
                });
            }
        });
    });

    // 10. Xử lý Đăng xuất
    $("#logoutBtn").click(function() {
        Swal.fire({
            title: 'Đăng xuất?',
            text: 'Bạn muốn thoát khỏi giao diện thu ngân?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Thoát',
            cancelButtonText: 'Ở lại',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                handleLogout();
            }
        });
    });

    function handleLogout() {
        localStorage.clear();
        window.location.href = "index.html";
    }

    // Helper định dạng tiền VNĐ
    function formatMoney(amount) {
        return parseInt(amount).toLocaleString('vi-VN') + 'đ';
    }
});
