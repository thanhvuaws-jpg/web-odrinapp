$(document).ready(function() {
    initGoldParticles();

    function initGoldParticles() {
        const container = document.getElementById('goldParticles');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'gold-particle';
            const size = Math.random() * 4 + 2;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${Math.random() * 100}%`;
            p.style.animationDuration = `${Math.random() * 15 + 10}s`;
            p.style.animationDelay = `${Math.random() * 15}s`;
            p.style.opacity = Math.random() * 0.7 + 0.3;
            container.appendChild(p);
        }
    }

    // Theme Switcher Logic
    let currentTheme = localStorage.getItem("theme") || "dark";
    applyTheme(currentTheme);

    $("#themeToggle").click(function() {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("theme", currentTheme);
        applyTheme(currentTheme);
        
        // Vẽ lại biểu đồ khi chuyển chủ đề để đổi màu chữ trục
        if (activeTab === 'overview') {
            loadOverviewStats();
        }
    });

    function applyTheme(theme) {
        if (theme === "light") {
            $("html").removeClass("dark").addClass("light");
        } else {
            $("html").addClass("dark").removeClass("light");
        }
    }

    // Helper kiểm tra màn hình tối để tạo popup đẹp phù hợp
    function getSwalBg() {
        return $("html").hasClass("dark") ? '#0f172a' : '#ffffff';
    }
    function getSwalColor() {
        return $("html").hasClass("dark") ? '#f1f5f9' : '#0f172a';
    }

    // 1. Kiểm tra session đăng nhập
    const manv = localStorage.getItem("manv");
    const hoten = localStorage.getItem("hoten");
    const maquyen = localStorage.getItem("maquyen");
    const token = localStorage.getItem("token");

    if (!manv || !token || parseInt(maquyen) !== 1) {
        // Nếu không phải Admin hoặc chưa đăng nhập -> Về trang Login
        handleLogout();
        return;
    }

    $("#adminName").text(hoten);

    let socket = null;
    let sessionCheckInterval = null;
    let revenueChart = null;
    let activeTab = 'overview';
    let categories = [];
    let selectedCategory = null;

    // 2. Chạy đồng hồ thời gian thực
    function updateClock() {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const dateStr = now.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        $("#liveTime").html(`<i class="fa-regular fa-clock mr-1"></i>${dateStr} - ${timeStr}`);
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

    // 4. Quản lý chuyển đổi Tab (Overview, Menu, Staff)
    $("#nav-overview").click(function(e) {
        e.preventDefault();
        switchTab('overview', 'Tổng Quan Thống Kê', 'Báo cáo hiệu suất kinh doanh thời gian thực');
    });

    $("#nav-menu").click(function(e) {
        e.preventDefault();
        switchTab('menu', 'Quản Lý Thực Đơn', 'Thêm, sửa, xóa danh mục món ăn & thực đơn nhà hàng');
    });

    $("#nav-staff").click(function(e) {
        e.preventDefault();
        switchTab('staff', 'Quản Lý Nhân Viên', 'Phân quyền, quản lý tài khoản nhân sự hoạt động');
    });

    $("#nav-tables").click(function(e) {
        e.preventDefault();
        switchTab('tables', 'Quản Lý Bàn Ăn', 'Thêm, đổi tên, xóa bàn và theo dõi trạng thái thời gian thực');
    });

    $("#nav-bookings").click(function(e) {
        e.preventDefault();
        switchTab('bookings', 'Quản Lý Đặt Bàn', 'Xác nhận phiếu đặt, ghi nhận khách đến và hủy phiếu');
    });

    // Trước đây dòng này truyền `this` (thẻ <a>) vào chỗ tham số `title`, nên
    // tiêu đề trang hiện ra "[object HTMLAnchorElement]" còn phụ đề thì giữ
    // nguyên của tab trước. Sửa lại cho đúng chữ ký ba tham số.
    $("#nav-kho").click(function(e) {
        e.preventDefault();
        switchTab('kho', 'Kho Nguyên Vật Liệu',
            'Tồn kho, nhập hàng, xuất cho bếp, hủy hàng và kiểm kê');
    });

    $("#nav-vouchers").click(function(e) {
        e.preventDefault();
        switchTab('vouchers', 'Quản Lý Voucher',
                  'Tạo chương trình khuyến mãi, đặt khung thời gian chạy và theo dõi số mã đã phát');
    });

    $("#nav-chat").click(function(e) {
        e.preventDefault();
        switchTab('chat', 'Chăm Sóc Khách Hàng',
                  'Trả lời thắc mắc và khiếu nại của khách gửi từ ứng dụng');
    });
    $("#nav-landing").click(function(e) {
        e.preventDefault();
        switchTab('landing', 'Quản Lý Landing Page', 'Tùy chỉnh nội dung, thông tin hotline và thực đơn công khai cho khách hàng');
    });



    function switchTab(tab, title, subtitle) {
        // Báo tab CŨ biết là nó sắp bị ẩn. Màn hình chăm sóc khách hàng dùng
        // tín hiệu này để tắt vòng hỏi lại — nếu không, trang quản trị mở suốt
        // ca sẽ gọi mạng hàng nghìn lần cho một tab không ai nhìn.
        if (activeTab && activeTab !== tab) {
            document.dispatchEvent(new CustomEvent('admin:roi-tab', { detail: activeTab }));
        }
        activeTab = tab;
        // Cập nhật trạng thái active menu
        $("nav a").removeClass("nav-item-active");
        $(`#nav-${tab}`).addClass("nav-item-active");

        // Cập nhật tiêu đề trang
        $("#pageTitle").text(title);
        $("#pageSubtitle").text(subtitle);

        // Hiển thị panel tương ứng
        $("#tab-overview-content").addClass("hidden");
        $("#tab-menu-content").addClass("hidden");
        $("#tab-staff-content").addClass("hidden");
        $("#tab-tables-content").addClass("hidden");
        $("#tab-bookings-content").addClass("hidden");
        $("#tab-kho-content").addClass("hidden");
        $("#tab-vouchers-content").addClass("hidden");
        $("#tab-chat-content").addClass("hidden");
        $("#tab-landing-content").addClass("hidden");
        $(`#tab-${tab}-content`).removeClass("hidden");

        // Tải dữ liệu tương ứng
        if (tab === 'overview') {
            loadOverviewStats();
        } else if (tab === 'menu') {
            loadCategories();
        } else if (tab === 'staff') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-nhan-vien'));
        } else if (tab === 'tables') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-ban-an'));
        } else if (tab === 'bookings') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-dat-ban'));
        } else if (tab === 'kho') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-kho'));
        } else if (tab === 'vouchers') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-voucher'));
        } else if (tab === 'chat') {
            document.dispatchEvent(new CustomEvent('admin:mo-tab-chat'));
        } else if (tab === 'landing') {
            loadLandingConfig();
            loadLandingDishPreviews();
        }
    }

    // 5. TẢI DỮ LIỆU TỔNG QUAN (Tab Overview)
    function loadOverviewStats() {
        // Đếm số bàn đang hoạt động
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_tables.php",
            type: "GET",
            dataType: "json",
            success: function(tables) {
                const activeTables = tables.filter(t => t.TINHTRANG === 'true').length;
                $("#statTables").text(activeTables + " bàn");
            }
        });

        // Đếm tổng số nhân sự
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_staff.php",
            type: "GET",
            dataType: "json",
            success: function(staffList) {
                $("#statStaff").text(staffList.length + " nhân sự");
            }
        });

        // Tải báo cáo doanh số & vẽ biểu đồ doanh thu
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_statistics.php",
            type: "GET",
            dataType: "json",
            success: function(stats) {
                if (stats.status === "error") return;

                // Tính tổng doanh thu & đơn hàng
                let totalRevenue = 0;
                stats.forEach(s => {
                    totalRevenue += parseFloat(s.doanhthu);
                });
                $("#statRevenue").text(formatMoney(totalRevenue));
                $("#statOrders").text(stats.length + " đơn");

                // Chuẩn bị dữ liệu vẽ biểu đồ
                const labels = stats.map(s => {
                    const parts = s.ngay.split('-');
                    return `${parts[2]}/${parts[1]}`; // DD/MM
                });
                const revenues = stats.map(s => parseFloat(s.doanhthu));

                drawChart(labels, revenues);
            }
        });
    }
    loadOverviewStats(); // Load mặc định khi mở trang

    function drawChart(labels, data) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        if (revenueChart) {
            revenueChart.destroy();
        }

        // Tạo gradient đổ màu dưới nét vẽ line biểu đồ cực đẹp
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
        gradientFill.addColorStop(1, 'rgba(212, 175, 55, 0.00)');

        const isDark = $("html").hasClass("dark");
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#475569';
        
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: data,
                    borderColor: '#d4af37',
                    backgroundColor: gradientFill,
                    borderWidth: 3.5,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#d4af37',
                    pointBorderColor: isDark ? '#0b0f19' : '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            font: { family: 'Outfit' },
                            callback: function(value) {
                                return value.toLocaleString('vi-VN') + 'đ';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            font: { family: 'Outfit' },
                            color: textColor
                        }
                    }
                }
            }
        });
    }

    // 6. QUẢN LÝ THỰC ĐƠN (Tab Menu)
    /* ------------------------------------------------------------------
     * ĐÃ CHUYỂN SANG js/screens/CategoryScreen.js
     * ------------------------------------------------------------------
     * Phần quản lý danh mục nay do lớp CategoryScreen đảm nhiệm (nạp, vẽ,
     * thêm, sửa, xóa). Hàm này chỉ còn nhiệm vụ báo cho module mới biết
     * rằng tab Thực đơn vừa được mở.
     *
     * Dùng sự kiện tùy biến thay vì gọi trực tiếp, vì admin.js là script
     * thường còn CategoryScreen là ES module — hai bên không thấy phạm vi
     * của nhau. Sự kiện cũng khiến ranh giới tạm thời này dễ nhận ra khi
     * chuyển nốt Món ăn và Nhân viên sang lớp mới.
     * ------------------------------------------------------------------ */
    function loadCategories() {
        document.dispatchEvent(new CustomEvent('admin:mo-tab-thuc-don'));
    }


    /* Bảng món ăn nay do DishScreen quản lý; sự kiện
       admin:chon-danh-muc được xử lý trong js/app-admin.js. */



    // Modal Thêm/Sửa Danh mục



    // Modal Thêm/Sửa Món ăn



    // 7. QUẢN LÝ NHÂN VIÊN (Tab Staff)


    // Modal Thêm/Sửa Nhân viên
    /* Nút thêm tài khoản nay do StaffScreen xử lý. */



    // 8. ĐĂNG XUẤT
    $("#logoutBtn").click(function() {
        Swal.fire({
            title: 'Đăng xuất?',
            text: 'Bạn muốn thoát khỏi màn hình quản trị?',
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

    // Helper định dạng ảnh sang Base64
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Tách phần đầu data:image/jpeg;base64,
                const base64Str = reader.result.split(',')[1];
                resolve(base64Str);
            };
            reader.onerror = error => reject(error);
        });
    }

    // Helper định dạng tiền VNĐ
    function formatMoney(amount) {
        return parseInt(amount).toLocaleString('vi-VN') + 'đ';
    }

    // =============================================
    // 🔔 NOTIFICATION MODULE — WebSocket (Socket.io)
    // =============================================
    let knownOrderIds = new Set(); // Lưu mã đơn đã biết để phát hiện đơn mới
    let notifList = [];            // Danh sách thông báo hiển thị trong panel
    let unreadCount = 0;
    let notifPanelOpen = false;

    // =====================================================================
    // Mốc "đơn đã xem" — lưu bền qua các lần tải trang
    // =====================================================================
    // Phiên bản cũ đánh dấu MỌI đơn trong ngày là "đã biết" ngay khi tải
    // trang, rồi mới bật WebSocket. Hệ quả: đơn được thanh toán trong lúc
    // quản lý không mở trang sẽ bị xếp vào nhóm "đã biết" và im lặng vĩnh
    // viễn — không bao giờ hiện thông báo nữa.
    //
    // Cách sửa: ghi nhớ mã đơn lớn nhất ĐÃ THỰC SỰ hiển thị cho người dùng
    // vào localStorage. Lần tải trang sau, mọi đơn có mã lớn hơn mốc đó là
    // đơn phát sinh khi người dùng vắng mặt, và phải được báo lại.
    const KEY_MOC_DA_XEM = 'ROYAL_ADMIN_LAST_SEEN_ORDER';

    function docMocDaXem() {
        try {
            const v = localStorage.getItem(KEY_MOC_DA_XEM);
            return v === null ? null : parseInt(v, 10);
        } catch (e) {
            return null; // chế độ ẩn danh hoặc trình duyệt chặn lưu trữ
        }
    }

    function ghiMocDaXem(id) {
        try {
            const hienTai = docMocDaXem() || 0;
            if (id > hienTai) localStorage.setItem(KEY_MOC_DA_XEM, String(id));
        } catch (e) { /* không lưu được thì bỏ qua, không làm hỏng luồng chính */ }
    }

    // Khởi tạo: nạp đơn hôm nay, báo lại những đơn phát sinh lúc vắng mặt
    function initNotifications() {
        $.ajax({
            url: CONFIG.BASE_URL + 'api/get_paid_orders.php',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                if (!Array.isArray(data)) return;

                const today = getTodayStr();
                const donHomNay = data
                    .filter(o => o.NGAYDAT && o.NGAYDAT.startsWith(today))
                    .sort((a, b) => parseInt(a.MADONDAT) - parseInt(b.MADONDAT));

                const moc = docMocDaXem();
                const maLonNhat = donHomNay.reduce(
                    (m, o) => Math.max(m, parseInt(o.MADONDAT) || 0), 0);

                if (moc === null) {
                    // Lần đầu dùng trên trình duyệt này: coi như đã xem hết,
                    // tránh dội một loạt thông báo về các đơn cũ.
                    donHomNay.forEach(o => knownOrderIds.add(parseInt(o.MADONDAT)));
                    if (maLonNhat > 0) ghiMocDaXem(maLonNhat);
                } else {
                    let soDonBoLo = 0;
                    donHomNay.forEach(o => {
                        const id = parseInt(o.MADONDAT);
                        knownOrderIds.add(id);
                        if (id > moc) {
                            addNotification(o); // đơn phát sinh lúc vắng mặt
                            soDonBoLo++;
                        }
                    });
                    if (maLonNhat > 0) ghiMocDaXem(maLonNhat);
                    if (soDonBoLo > 0) {
                        console.log(`🔔 Khôi phục ${soDonBoLo} đơn phát sinh khi vắng mặt`);
                    }
                }

                // Khởi động kết nối WebSocket để nhận đơn real-time
                initWebSocket();
            }
        });
    }

    /* Cầu nối tạm thời: các module ES (CategoryScreen…) chưa có socket
       riêng nên nhờ kết nối của tệp này phát hộ. Bỏ được khi toàn bộ màn
       hình đã chuyển sang SocketBus. */
    document.addEventListener('admin:socket-phat', function (e) {
        const ten = e.detail && e.detail.tenSuKien;
        if (ten && socket && socket.connected) {
            socket.emit(ten, e.detail.duLieu);
        }
    });

    // Kết nối WebSocket Socket.io
    function initWebSocket() {
        // Socket.IO luôn đi qua CÙNG origin với trang web. Apache (container
        // "web") chuyển tiếp /socket.io/ sang container resto-socket, xử lý
        // cả long-polling lẫn nâng cấp WebSocket.
        //
        // Đoạn cũ ghi cứng IP của VPS và kích hoạt khi hostname là localhost,
        // nghĩa là chạy ở môi trường local thì luôn cố nối tới máy chủ đó.
        // VPS nay đã bị hủy nên nhánh này khiến kết nối treo tới khi timeout.
        let socketUrl = window.location.origin;

        // Chỉ khi mở tệp trực tiếp bằng giao thức file:// mới không có origin
        // hợp lệ để suy ra — khi đó trỏ về cổng của container web.
        if (window.location.protocol === 'file:') {
            socketUrl = 'http://localhost:8000';
        }
        
        console.log('Connecting to WebSocket at:', socketUrl);
        socket = io(socketUrl, {
            path: '/socket.io/'
        });

        socket.on('connect', () => {
            console.log('🔌 WebSocket connected!');
            socket.emit('join_admin'); // Join vào room admin nhận đơn
        });

        socket.on('new_order_paid', (orders) => {
            if (!Array.isArray(orders)) return;
            orders.forEach(order => {
                const orderId = parseInt(order.MADONDAT);
                if (!knownOrderIds.has(orderId)) {
                    knownOrderIds.add(orderId);
                    addNotification(order);
                    // Ghi mốc ngay khi thông báo thực sự hiển thị, để lần tải
                    // trang sau không báo lại đơn này lần nữa.
                    ghiMocDaXem(orderId);
                }
            });
        });

        /* Máy chủ tự dò phiếu đặt bàn mới rồi đẩy về đây.
           Phải do máy chủ dò vì phiếu từ landing page đi qua endpoint công
           khai, mà trang đó không có kết nối Socket.IO để tự báo. */
        socket.on('new_booking', (danhSach) => {
            xuLyPhieuDatBan(danhSach);
        });

        socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected. Auto-reconnecting...');
        });
    }

    // Thêm 1 thông báo mới vào hệ thống
    function addNotification(order) {
        const notif = {
            loai: 'don',                 // phân biệt với thông báo đặt bàn
            id: 'don-' + order.MADONDAT,
            // Đơn không gắn bàn (MABAN = NULL) là hợp lệ trong CSDL — ví dụ
            // đơn mô phỏng từ màn kho. Không có dự phòng thì thông báo hiện
            // nguyên văn "null vừa thanh toán xong!". Phần phiếu đặt bàn bên
            // dưới đã xử lý đúng kiểu này từ trước; chỉ phần đơn hàng quên.
            tenBan: order.TENBAN || ('Đơn #' + order.MADONDAT),
            tongTien: order.TONGTIEN,
            nhanVien: order.HOTENNV,
            phuongThuc: order.PHUONGTHUCTT || 'Tiền mặt',
            // Xem chú thích hàm layGioPhut() trong cashier.html: nếu chuỗi
            // thời gian không chứa dấu cách thì split(' ')[1] là undefined
            // và .substring() sẽ ném TypeError giữa vòng lặp dựng giao diện.
            thoiGian: (function (s) {
                if (!s || typeof s !== 'string') return '--:--';
                const p = s.split(' ');
                return (p.length < 2 || !p[1]) ? '--:--' : p[1].substring(0, 5);
            })(order.NGAYDAT),
            read: false
        };

        notifList.unshift(notif); // Thêm vào đầu danh sách
        unreadCount++;

        updateBadge();
        renderNotifPanel();
        showToast(notif);
    }

    // Cập nhật badge số trên nút chuông
    /* ==================================================================
     * THÔNG BÁO ĐẶT BÀN
     * ==================================================================
     * Dùng chung panel và badge với thông báo thanh toán, chỉ khác biểu
     * tượng và nội dung. Gộp chung để người quản lý có MỘT chỗ duy nhất
     * cần theo dõi, thay vì phải nhớ nhìn hai nơi.
     *
     * Mốc "đã xem" lưu riêng khỏi mốc của đơn hàng: hai loại có dãy mã
     * độc lập nhau, dùng chung một mốc sẽ làm mất thông báo của loại có
     * mã nhỏ hơn.
     */
    const KEY_MOC_DAT_BAN = 'ROYAL_ADMIN_LAST_SEEN_BOOKING';
    let knownBookingIds = new Set();

    function docMocDatBan() {
        try {
            const v = localStorage.getItem(KEY_MOC_DAT_BAN);
            return v === null ? null : parseInt(v, 10);
        } catch (e) { return null; }
    }

    function ghiMocDatBan(id) {
        try {
            const htai = docMocDatBan() || 0;
            if (id > htai) localStorage.setItem(KEY_MOC_DAT_BAN, String(id));
        } catch (e) { /* bỏ qua */ }
    }

    /**
     * Tách chuỗi thời gian hẹn thành { gio, ngay } để hiển thị.
     *
     * Nhận cả hai định dạng vì hai nguồn dữ liệu khác nhau:
     *   - REST/PDO  : '2026-09-17 18:00:00'  (dấu cách)
     *   - mysql2 cũ : '2026-09-17T18:00:00.000Z' (ISO, sau khi JSON hóa)
     * Máy chủ socket nay đã bật dateStrings nên luôn trả dạng thứ nhất,
     * nhưng vẫn nhận dạng ISO để một lần đổi thư viện không làm vỡ giao
     * diện lần nữa. Ngày hiển thị theo kiểu Việt Nam: dd/mm.
     */
    function tachGioNgayHen(chuoi) {
        if (!chuoi) return { gio: '--:--', ngay: '' };

        const m = String(chuoi).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
        if (!m) return { gio: '--:--', ngay: '' };

        return { gio: m[4] + ':' + m[5], ngay: m[3] + '/' + m[2] };
    }

    function themThongBaoDatBan(phieu) {
        const notif = {
            loai: 'datban',
            id: 'datban-' + phieu.MADATBAN,
            maPhieu: phieu.MADATBAN,
            tenKhach: phieu.TENNGUOIDAT || 'Khách vãng lai',
            sdt: phieu.SDTNGUOIDAT || '',
            tenBan: phieu.TENBAN || 'Chưa xếp bàn',
            soKhach: parseInt(phieu.SOKHACH, 10) || 0,
            ghiChu: phieu.GHICHU || '',
            thoiGianHen: phieu.THOIGIANHEN || '',
            read: false
        };

        notifList.unshift(notif);
        unreadCount++;
        updateBadge();
        renderNotifPanel();
        hienToastDatBan(notif);
    }

    /**
     * Xử lý gói phiếu đặt bàn từ máy chủ.
     *
     * Máy chủ gửi NGUYÊN danh sách phiếu đang chờ (không chỉ phiếu mới),
     * nên phải tự lọc ra cái nào chưa từng báo. Cách này giống hệt cơ chế
     * của new_order_paid và có ưu điểm: gửi lại nhiều lần vẫn an toàn.
     */
    function xuLyPhieuDatBan(danhSach) {
        if (!Array.isArray(danhSach)) return;

        const moc = docMocDatBan();
        const sapXep = danhSach.slice().sort(
            (a, b) => parseInt(a.MADATBAN) - parseInt(b.MADATBAN));
        const maLonNhat = sapXep.reduce(
            (m, p) => Math.max(m, parseInt(p.MADATBAN) || 0), 0);

        if (moc === null) {
            // Lần đầu dùng trên trình duyệt này: đánh dấu đã xem hết, tránh
            // dội một loạt thông báo về các phiếu cũ.
            sapXep.forEach(p => knownBookingIds.add(parseInt(p.MADATBAN)));
            if (maLonNhat > 0) ghiMocDatBan(maLonNhat);
            return;
        }

        let soMoi = 0;
        sapXep.forEach(p => {
            const id = parseInt(p.MADATBAN);
            if (!knownBookingIds.has(id) && id > moc) {
                knownBookingIds.add(id);
                themThongBaoDatBan(p);
                ghiMocDatBan(id);
                soMoi++;
            } else {
                knownBookingIds.add(id);
            }
        });
        if (soMoi > 0) console.log(`📅 ${soMoi} phiếu đặt bàn mới`);
    }

    function hienToastDatBan(n) {
        const { gio, ngay } = tachGioNgayHen(n.thoiGianHen);

        const toast = $(`
            <div class="toast-notif pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-2xl text-white cursor-pointer"
                 style="background:rgba(15,23,42,0.95);border:1px solid rgba(96,165,250,0.45);backdrop-filter:blur(16px);
                        animation:slideInRight 0.4s ease forwards;min-width:280px;max-width:320px;">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/20">
                    <i class="fa-solid fa-calendar-check text-blue-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white">Có khách đặt bàn mới!</p>
                    <p class="text-sm font-black text-blue-300 mt-0.5">${n.tenKhach}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">${n.tenBan} · ${gio} ${ngay}${n.soKhach ? ' · ' + n.soKhach + ' khách' : ''}</p>
                </div>
                <i class="fa-solid fa-xmark text-gray-500 hover:text-white text-xs flex-shrink-0 toast-close"></i>
            </div>
        `);

        $('#toastContainer').append(toast);
        toast.find('.toast-close').click(function (e) {
            e.stopPropagation();
            toast.remove();
        });
        setTimeout(() => toast.fadeOut(300, () => toast.remove()), 7000);
    }

    function updateBadge() {
        const badge = $('#notifBadge');
        if (unreadCount > 0) {
            badge.text(unreadCount > 99 ? '99+' : unreadCount).removeClass('hidden');
        } else {
            badge.addClass('hidden');
        }
    }

    // Render danh sách trong dropdown panel
    function renderNotifPanel() {
        const container = $('#notifList');
        if (notifList.length === 0) {
            container.html(`
                <div id="notifEmpty" class="flex flex-col items-center justify-center py-8 text-gray-500">
                    <i class="fa-regular fa-bell-slash text-2xl mb-2 opacity-40"></i>
                    <p class="text-xs">Chưa có thông báo nào</p>
                </div>
            `);
            return;
        }

        let html = '';
        notifList.forEach(n => {
            const readClass = n.read ? 'opacity-60' : '';

            // Thông báo đặt bàn có cấu trúc dữ liệu khác hẳn thông báo
            // thanh toán, nên vẽ riêng thay vì cố nhồi vào cùng một khuôn.
            if (n.loai === 'datban') {
                const { gio, ngay } = tachGioNgayHen(n.thoiGianHen);
                html += `
                <div class="notif-item px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${readClass}" data-id="${n.id}">
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-500/20">
                            <i class="fa-solid fa-calendar-check text-blue-400 text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                                <p class="text-xs font-bold text-white">Đặt bàn mới · #${n.maPhieu}</p>
                                ${!n.read ? '<span class="w-2 h-2 rounded-full bg-gold-400 flex-shrink-0 ml-1"></span>' : ''}
                            </div>
                            <p class="text-[11px] text-blue-300 font-bold mt-0.5">${n.tenKhach}${n.sdt ? ' · ' + n.sdt : ''}</p>
                            <div class="flex items-center space-x-2 mt-1 flex-wrap">
                                <span class="text-[10px] text-gray-500">${n.tenBan}</span>
                                <span class="text-[10px] text-gray-600">•</span>
                                <span class="text-[10px] text-gray-500">${gio} ${ngay}</span>
                                ${n.soKhach ? '<span class="text-[10px] text-gray-600">•</span><span class="text-[10px] text-gray-500">' + n.soKhach + ' khách</span>' : ''}
                            </div>
                            ${n.ghiChu ? '<p class="text-[10px] text-gray-500 italic mt-1">“' + n.ghiChu + '”</p>' : ''}
                        </div>
                    </div>
                </div>`;
                return;
            }

            const isTransfer = n.phuongThuc === 'Chuyển khoản';
            html += `
                <div class="notif-item px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${readClass}" data-id="${n.id}">
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isTransfer ? 'bg-blue-500/20' : 'bg-emerald-500/20'}">
                            <i class="fa-solid ${isTransfer ? 'fa-qrcode text-blue-400' : 'fa-money-bill-wave text-emerald-400'} text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                                <p class="text-xs font-bold text-white">${n.tenBan} đã thanh toán</p>
                                ${!n.read ? '<span class="w-2 h-2 rounded-full bg-gold-400 flex-shrink-0 ml-1"></span>' : ''}
                            </div>
                            <p class="text-[11px] text-gold-400 font-black mt-0.5">${parseInt(n.tongTien).toLocaleString('vi-VN')}đ</p>
                            <div class="flex items-center space-x-2 mt-1">
                                <span class="text-[10px] text-gray-500">${n.thoiGian}</span>
                                <span class="text-[10px] text-gray-600">•</span>
                                <span class="text-[10px] text-gray-500">${n.nhanVien}</span>
                                <span class="text-[10px] text-gray-600">•</span>
                                <span class="text-[10px] ${isTransfer ? 'text-blue-400' : 'text-emerald-400'}">${n.phuongThuc}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.html(html);

        // Bấm vào thông báo → xem chi tiết
        $('.notif-item').click(function() {
            const id = $(this).data('id');
            const notif = notifList.find(n => n.id == id);
            if (!notif) return;

            // Đánh dấu đã đọc
            if (!notif.read) {
                notif.read = true;
                unreadCount = Math.max(0, unreadCount - 1);
                updateBadge();
                renderNotifPanel();
            }

            // Hiện chi tiết đơn
            Swal.fire({
                title: `<span style="color:#d4af37">🧾 Chi tiết ${notif.tenBan}</span>`,
                html: `
                    <div style="text-align:left; color:#e2e8f0; line-height:2">
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                            <span style="color:#94a3b8;font-size:13px">Mã đơn</span>
                            <span style="font-weight:bold;font-family:monospace">#${notif.id}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                            <span style="color:#94a3b8;font-size:13px">Bàn</span>
                            <span style="font-weight:bold">${notif.tenBan}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                            <span style="color:#94a3b8;font-size:13px">Nhân viên</span>
                            <span>${notif.nhanVien}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                            <span style="color:#94a3b8;font-size:13px">Thời gian</span>
                            <span>${notif.thoiGian}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
                            <span style="color:#94a3b8;font-size:13px">Phương thức</span>
                            <span style="color:${notif.phuongThuc === 'Chuyển khoản' ? '#60a5fa' : '#34d399'}">${notif.phuongThuc}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:12px 0 4px">
                            <span style="color:#94a3b8;font-size:13px;font-weight:bold">TỔNG THANH TOÁN</span>
                            <span style="font-size:20px;font-weight:900;color:#d4af37">${parseInt(notif.tongTien).toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                `,
                background: '#0f172a',
                color: '#e2e8f0',
                confirmButtonColor: '#d4af37',
                confirmButtonText: 'Đóng',
                showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' }
            });
        });
    }

    // Hiện Toast notification góc phải màn hình
    function showToast(notif) {
        const isTransfer = notif.phuongThuc === 'Chuyển khoản';
        const toast = $(`
            <div class="toast-notif pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-2xl text-white cursor-pointer"
                 style="background:rgba(15,23,42,0.95);border:1px solid rgba(212,175,55,0.4);backdrop-filter:blur(16px);
                        animation:slideInRight 0.4s ease forwards;min-width:280px;max-width:320px;">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isTransfer ? 'bg-blue-500/20' : 'bg-emerald-500/20'}">
                    <i class="fa-solid fa-cash-register ${isTransfer ? 'text-blue-400' : 'text-emerald-400'}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white">${notif.tenBan} vừa thanh toán xong!</p>
                    <p class="text-sm font-black text-gold-400 mt-0.5">${parseInt(notif.tongTien).toLocaleString('vi-VN')}đ</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">${notif.phuongThuc} · ${notif.nhanVien}</p>
                </div>
                <i class="fa-solid fa-xmark text-gray-500 hover:text-white text-xs flex-shrink-0 toast-close"></i>
            </div>
        `);

        $('#toastContainer').append(toast);

        // Bấm X để đóng sớm
        toast.find('.toast-close').click(function(e) {
            e.stopPropagation();
            toast.fadeOut(300, () => toast.remove());
        });

        // Bấm toast để xem chi tiết và mở panel
        toast.click(function() {
            toast.fadeOut(300, () => toast.remove());
            openNotifPanel();
        });

        // Tự đóng sau 5 giây
        setTimeout(() => {
            toast.fadeOut(400, () => toast.remove());
        }, 5000);
    }

    // Helper: lấy chuỗi ngày hôm nay dạng YYYY-MM-DD
    function getTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }

    // Mở/Đóng notification panel
    function openNotifPanel() {
        $('#notifPanel').removeClass('hidden');
        notifPanelOpen = true;
    }
    function closeNotifPanel() {
        $('#notifPanel').addClass('hidden');
        notifPanelOpen = false;
    }

    // Toggle panel khi bấm chuông
    $('#notifBtn').click(function(e) {
        e.stopPropagation();
        if (notifPanelOpen) {
            closeNotifPanel();
        } else {
            openNotifPanel();
        }
    });

    // Đóng panel khi bấm ra ngoài
    $(document).click(function(e) {
        if (notifPanelOpen && !$(e.target).closest('#notifPanel, #notifBtn').length) {
            closeNotifPanel();
        }
    });

    // Xoá tất cả thông báo
    $('#notifMarkAllRead').click(function(e) {
        e.stopPropagation();
        notifList = [];
        unreadCount = 0;
        updateBadge();
        renderNotifPanel();
    });

    // Thêm CSS animation cho toast vào DOM
    $('<style>')
        .text(`
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to   { opacity: 1; transform: translateX(0); }
            }
        `)
        .appendTo('head');

    // Khởi động hệ thống thông báo
    initNotifications();

    // ============================================
    // QUẢN LÝ LANDING PAGE (TAB LANDING)
    // ============================================
    function loadLandingConfig() {
        const config = JSON.parse(localStorage.getItem('ROYAL_LANDING_CONFIG') || '{}');
        $("#cfgHeroTitle").val(config.heroTitle || "Trải Nghiệm Ẩm Thực Đỉnh Cao & Sang Trọng");
        $("#cfgHeroDesc").val(config.heroDesc || "Hương vị độc bản được chế tác tỉ mỉ bởi các đầu bếp hàng đầu trong không gian thượng hạng.");
        $("#cfgHotline").val(config.hotline || "0909 123 456 — 028 3822 9999");
        $("#cfgAddress").val(config.address || "123 Đường Hoàng Gia, Quận 1, TP. Hồ Chí Minh");
        $("#cfgHours").val(config.hours || "Thứ 2 - Chủ Nhật: 10:00 AM - 11:00 PM");
    }

    $("#landingConfigForm").submit(function(e) {
        e.preventDefault();
        const config = {
            heroTitle: $("#cfgHeroTitle").val().trim(),
            heroDesc: $("#cfgHeroDesc").val().trim(),
            hotline: $("#cfgHotline").val().trim(),
            address: $("#cfgAddress").val().trim(),
            hours: $("#cfgHours").val().trim()
        };
        localStorage.setItem('ROYAL_LANDING_CONFIG', JSON.stringify(config));

        Swal.fire({
            icon: 'success',
            title: 'Đã lưu cấu hình!',
            text: 'Nội dung Landing Page đã được cập nhật thành công.',
            timer: 1500,
            showConfirmButton: false,
            background: getSwalBg(),
            color: getSwalColor()
        });
    });

    $("#btnLandingAddDish").click(function() {
        $("#btnAddDish").click();
    });

    function loadLandingDishPreviews() {
        const container = $("#landingDishPreviewList");
        container.html(`
            <div class="text-center py-8 text-gray-500">
                <i class="fa-solid fa-spinner fa-spin text-xl mb-2"></i>
                <p class="text-xs">Đang tải thực đơn Landing Page...</p>
            </div>
        `);

        $.ajax({
            url: CONFIG.BASE_URL + "api/get_dishes.php",
            type: "GET",
            dataType: "json",
            success: function(res) {
                let list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
                if (list.length === 0) {
                    container.html(`
                        <div class="text-center py-8 text-gray-500">
                            <i class="fa-solid fa-utensils text-2xl mb-2 opacity-40"></i>
                            <p class="text-xs">Chưa có món ăn nào trong hệ thống</p>
                        </div>
                    `);
                    return;
                }

                let html = '';
                list.forEach(dish => {
                    const name = dish.TENMON || dish.tenMon || 'Món ăn';
                    const price = Number(dish.GIATIEN || dish.giaTien || 0).toLocaleString('vi-VN') + 'đ';
                    let img = dish.HINHANH || 'landing-page/assets/pho_bo.png';
                    if (!img.startsWith('http') && !img.startsWith('assets/') && !img.startsWith('landing-page/')) {
                        img = CONFIG.BASE_URL + img;
                    }

                    html += `
                        <div class="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-gold-400/10 hover:border-gold-400/30 transition-all">
                            <div class="flex items-center space-x-3 min-w-0">
                                <img src="${img}" alt="${name}" class="w-12 h-12 rounded-lg object-cover border border-white/10" onerror="this.src='landing-page/assets/pho_bo.png'">
                                <div class="min-w-0">
                                    <h5 class="text-sm font-bold text-white truncate">${name}</h5>
                                    <p class="text-xs text-gold-400 font-semibold">${price}</p>
                                </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                                Đang Hiển Thị
                            </span>
                        </div>
                    `;
                });

                container.html(html);
            },
            error: function() {
                container.html(`
                    <div class="text-center py-8 text-red-400">
                        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                        <p class="text-xs">Không thể kết nối máy chủ để lấy thực đơn</p>
                    </div>
                `);
            }
        });
    }

});

