$(document).ready(function() {
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

    let sessionCheckInterval = null;
    let revenueChart = null;
    let activeTab = 'overview';
    let categories = [];
    let selectedCategory = null;
    let dishes = [];
    let staffs = [];

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

    function switchTab(tab, title, subtitle) {
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
        $(`#tab-${tab}-content`).removeClass("hidden");

        // Tải dữ liệu tương ứng
        if (tab === 'overview') {
            loadOverviewStats();
        } else if (tab === 'menu') {
            loadCategories();
        } else if (tab === 'staff') {
            loadStaffs();
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
    function loadCategories() {
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_categories.php",
            type: "GET",
            dataType: "json",
            success: function(data) {
                categories = data;
                renderCategories();
                
                // Nếu chưa có category được chọn, mặc định chọn category đầu tiên
                if (categories.length > 0) {
                    if (!selectedCategory || !categories.find(c => c.MALOAI === selectedCategory.MALOAI)) {
                        selectCategory(categories[0]);
                    } else {
                        // Refresh lại category hiện tại
                        const current = categories.find(c => c.MALOAI === selectedCategory.MALOAI);
                        selectCategory(current);
                    }
                } else {
                    $("#dishesTableBody").html(`
                        <tr>
                            <td colspan="4" class="py-6 text-center text-slate-500">Chưa có danh mục nào. Hãy tạo danh mục trước!</td>
                        </tr>
                    `);
                }
            }
        });
    }

    function renderCategories() {
        let html = '';
        categories.forEach(c => {
            const isSelected = selectedCategory && selectedCategory.MALOAI === c.MALOAI;
            const imgUrl = c.HINHANH ? CONFIG.BASE_URL + c.HINHANH : 'https://placehold.co/80x80?text=Menu';
            
            html += `
                <div data-id="${c.MALOAI}" 
                     class="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-all border ${isSelected ? 'border-gold bg-slate-100/80 dark:bg-slate-900/40 text-gold font-bold shadow-sm shadow-gold/5' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}">
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                        <img class="w-10 h-10 rounded-lg object-cover" src="${imgUrl}" alt="${c.TENLOAI}" onerror="this.src='https://placehold.co/80x80?text=Menu'">
                        <span class="truncate text-sm">${c.TENLOAI}</span>
                    </div>
                    <div class="flex items-center space-x-1 pl-2">
                        <button class="btnEditCategory p-1 text-slate-400 hover:text-gold transition-colors" data-id="${c.MALOAI}"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button class="btnDeleteCategory p-1 text-slate-400 hover:text-red-400 transition-colors" data-id="${c.MALOAI}"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
            `;
        });
        $("#categoriesList").html(html);

        // Click chọn danh mục
        $("#categoriesList > div").click(function(e) {
            // Tránh click trúng nút sửa/xóa
            if ($(e.target).closest('button').length > 0) return;
            const id = $(this).data("id");
            const catObj = categories.find(c => c.MALOAI == id);
            if (catObj) selectCategory(catObj);
        });

        // Click sửa danh mục
        $(".btnEditCategory").click(function(e) {
            e.stopPropagation();
            const id = $(this).data("id");
            const catObj = categories.find(c => c.MALOAI == id);
            if (catObj) showCategoryModal('edit', catObj);
        });

        // Click xóa danh mục
        $(".btnDeleteCategory").click(function(e) {
            e.stopPropagation();
            const id = $(this).data("id");
            confirmDeleteCategory(id);
        });
    }

    function selectCategory(category) {
        selectedCategory = category;
        renderCategories(); // Cập nhật style border
        $("#dishSectionTitle").text(`Món Ăn - ${category.TENLOAI}`);
        loadDishes(category.MALOAI);
    }

    function loadDishes(categoryId) {
        // Tải toàn bộ món ăn theo category không phân trang (search rỗng)
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_dishes.php",
            type: "GET",
            data: { maloai: categoryId, page: 1, limit: 100 },
            dataType: "json",
            success: function(response) {
                if (response.status === "success") {
                    dishes = response.data;
                    renderDishes();
                }
            }
        });
    }

    function renderDishes() {
        if (dishes.length === 0) {
            $("#dishesTableBody").html(`
                <tr>
                    <td colspan="4" class="py-6 text-center text-slate-400 dark:text-slate-500">Danh mục này chưa có món ăn nào</td>
                </tr>
            `);
            return;
        }

        let html = '';
        dishes.forEach(d => {
            const imgUrl = d.HINHANH ? CONFIG.BASE_URL + d.HINHANH : 'https://placehold.co/100x100?text=Food';
            const isChecked = d.TINHTRANG === 'true' ? 'checked' : '';
            
            html += `
                <tr class="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td class="py-3 flex items-center space-x-3">
                        <img class="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800" src="${imgUrl}" alt="${d.TENMON}" onerror="this.src='https://placehold.co/100x100?text=Food'">
                        <div>
                            <span class="font-semibold text-slate-800 dark:text-slate-200 block text-sm">${d.TENMON}</span>
                            <span class="text-xs text-slate-400 dark:text-slate-500">Mã món: #${d.MAMON}</span>
                        </div>
                    </td>
                    <td class="py-3 text-right font-extrabold text-slate-800 dark:text-white text-sm">${formatMoney(d.GIATIEN)}</td>
                    <td class="py-3 text-center">
                        <label class="relative inline-flex items-center cursor-pointer justify-center">
                            <input type="checkbox" data-id="${d.MAMON}" class="toggleDishStatus sr-only peer" ${isChecked}>
                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-600"></div>
                        </label>
                    </td>
                    <td class="py-3 text-right">
                        <div class="flex items-center justify-end space-x-2">
                            <button class="btnEditDish p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-gold hover:text-gold text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm" data-id="${d.MAMON}"><i class="fa-solid fa-pen"></i></button>
                            <button class="btnDeleteDish p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-900/50 hover:text-red-500 dark:hover:text-red-400 text-slate-550 dark:text-slate-400 transition-all text-xs shadow-sm" data-id="${d.MAMON}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        $("#dishesTableBody").html(html);

        // Bật tắt trạng thái món ăn
        $(".toggleDishStatus").change(function() {
            const maMon = $(this).data("id");
            const newStatus = $(this).is(":checked") ? "true" : "false";

            $.ajax({
                url: CONFIG.BASE_URL + "api/update_dish_status.php",
                type: "POST",
                data: { mamon: maMon, tinhtrang: newStatus },
                dataType: "json",
                success: function(response) {
                    if (response.status !== "success") {
                        Swal.fire({
                            icon: 'error',
                            title: 'Thất bại',
                            text: 'Không thể cập nhật trạng thái món ăn.',
                            background: getSwalBg(),
                            color: getSwalColor()
                        });
                        loadDishes(selectedCategory.MALOAI); // Reload lại nếu lỗi
                    }
                }
            });
        });

        // Click sửa món ăn
        $(".btnEditDish").click(function() {
            const id = $(this).data("id");
            const dishObj = dishes.find(d => d.MAMON == id);
            if (dishObj) showDishModal('edit', dishObj);
        });

        // Click xóa món ăn
        $(".btnDeleteDish").click(function() {
            const id = $(this).data("id");
            confirmDeleteDish(id);
        });
    }

    // Modal Thêm/Sửa Danh mục
    $("#btnAddCategory").click(function() {
        showCategoryModal('add');
    });

    function showCategoryModal(action, catData = null) {
        const title = action === 'add' ? 'Thêm Danh Mục' : 'Sửa Danh Mục';
        const nameVal = catData ? catData.TENLOAI : '';

        Swal.fire({
            title: title,
            html: `
                <div class="space-y-4 text-left">
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Tên danh mục</label>
                        <input type="text" id="swalCatName" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${nameVal}" placeholder="Nhập tên danh mục...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-455 dark:text-slate-400 mb-1">Ảnh danh mục</label>
                        <input type="file" id="swalCatImage" class="w-full bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-450 dark:text-slate-400 text-xs focus:outline-none focus:border-gold" accept="image/*">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Lưu lại',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor(),
            preConfirm: () => {
                const name = $("#swalCatName").val().trim();
                if (!name) {
                    Swal.showValidationMessage('Vui lòng nhập tên danh mục');
                    return false;
                }
                
                // Trả về dữ liệu
                const fileInput = document.getElementById('swalCatImage');
                if (fileInput.files.length > 0) {
                    return getBase64(fileInput.files[0]).then(base64 => {
                        return { name: name, image: base64 };
                    });
                }
                return { name: name, image: '' };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const payload = {
                    action: action,
                    tenloai: result.value.name,
                    hinhanh: result.value.image
                };
                if (action === 'edit') {
                    payload.maloai = catData.MALOAI;
                }

                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_category.php",
                    type: "POST",
                    data: payload,
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Thành công!', timer: 1500, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            loadCategories();
                        } else {
                            Swal.fire({ icon: 'error', title: 'Lỗi', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

    function confirmDeleteCategory(categoryId) {
        Swal.fire({
            title: 'Xóa danh mục?',
            text: 'Bạn có chắc chắn muốn xóa danh mục này? Hãy chắc chắn không có món ăn nào thuộc danh mục này.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý xóa',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_category.php",
                    type: "POST",
                    data: { action: 'delete', maloai: categoryId },
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1200, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            selectedCategory = null;
                            loadCategories();
                        } else {
                            Swal.fire({ icon: 'error', title: 'Thất bại', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

    // Modal Thêm/Sửa Món ăn
    $("#btnAddDish").click(function() {
        if (!selectedCategory) return;
        showDishModal('add');
    });

    function showDishModal(action, dishData = null) {
        const title = action === 'add' ? 'Thêm Món Ăn Mới' : 'Sửa Món Ăn';
        const nameVal = dishData ? dishData.TENMON : '';
        const priceVal = dishData ? dishData.GIATIEN : '';
        const statusVal = dishData ? dishData.TINHTRANG : 'true';

        Swal.fire({
            title: title,
            html: `
                <div class="space-y-4 text-left">
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Tên món ăn</label>
                        <input type="text" id="swalDishName" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${nameVal}" placeholder="Nhập tên món...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Đơn giá (VNĐ)</label>
                        <input type="number" id="swalDishPrice" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${priceVal}" placeholder="Nhập giá tiền...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Ảnh minh họa</label>
                        <input type="file" id="swalDishImage" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-4 text-slate-450 dark:text-slate-400 text-xs focus:outline-none focus:border-gold" accept="image/*">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Lưu lại',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor(),
            preConfirm: () => {
                const name = $("#swalDishName").val().trim();
                const price = $("#swalDishPrice").val().trim();
                
                if (!name || !price) {
                    Swal.showValidationMessage('Vui lòng điền đầy đủ tên và giá món ăn');
                    return false;
                }
                
                const fileInput = document.getElementById('swalDishImage');
                if (fileInput.files.length > 0) {
                    return getBase64(fileInput.files[0]).then(base64 => {
                        return { name: name, price: price, image: base64 };
                    });
                }
                return { name: name, price: price, image: '' };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const payload = {
                    action: action,
                    tenmon: result.value.name,
                    giatien: result.value.price,
                    hinhanh: result.value.image,
                    maloai: selectedCategory.MALOAI,
                    tinhtrang: statusVal
                };
                if (action === 'edit') {
                    payload.mamon = dishData.MAMON;
                }

                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_dish.php",
                    type: "POST",
                    data: payload,
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Thành công!', timer: 1500, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            loadDishes(selectedCategory.MALOAI);
                        } else {
                            Swal.fire({ icon: 'error', title: 'Lỗi', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

    function confirmDeleteDish(dishId) {
        Swal.fire({
            title: 'Xóa món ăn này?',
            text: 'Món ăn này sẽ bị xóa vĩnh viễn khỏi thực đơn của quán!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý xóa',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_dish.php",
                    type: "POST",
                    data: { action: 'delete', mamon: dishId },
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1200, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            loadDishes(selectedCategory.MALOAI);
                        } else {
                            Swal.fire({ icon: 'error', title: 'Thất bại', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

    // 7. QUẢN LÝ NHÂN VIÊN (Tab Staff)
    function loadStaffs() {
        $.ajax({
            url: CONFIG.BASE_URL + "api/get_staff.php",
            type: "GET",
            dataType: "json",
            success: function(data) {
                staffs = data;
                renderStaffs();
            }
        });
    }

    function renderStaffs() {
        if (staffs.length === 0) {
            $("#staffTableBody").html(`
                <tr>
                    <td colspan="5" class="py-6 text-center text-slate-550">Chưa có tài khoản nhân viên nào</td>
                </tr>
            `);
            return;
        }

        let html = '';
        staffs.forEach(s => {
            const roleColor = s.MAQUYEN == 1 
                ? 'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20' 
                : (s.MAQUYEN == 3 
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20');
            
            html += `
                <tr class="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800 dark:text-white text-sm">${s.HOTENNV}</td>
                    <td class="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs">${s.TENDN}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border ${roleColor}">${s.TENQUYEN}</span>
                    </td>
                    <td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium text-xs">
                        <div><i class="fa-solid fa-phone mr-1.5 text-slate-400"></i>${s.SDT || 'Chưa cập nhật'}</div>
                        <div class="mt-1"><i class="fa-solid fa-envelope mr-1.5 text-slate-400"></i>${s.EMAIL || 'Chưa cập nhật'}</div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end space-x-2">
                            <button class="btnEditStaff p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-gold hover:text-gold text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm" data-id="${s.MANV}"><i class="fa-solid fa-user-pen"></i></button>
                            <button class="btnDeleteStaff p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-900/50 hover:text-red-500 dark:hover:text-red-400 text-slate-550 dark:text-slate-400 transition-all text-xs shadow-sm" data-id="${s.MANV}"><i class="fa-solid fa-user-xmark"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        $("#staffTableBody").html(html);

        // Click sửa nhân viên
        $(".btnEditStaff").click(function() {
            const id = $(this).data("id");
            const staffObj = staffs.find(s => s.MANV == id);
            if (staffObj) showStaffModal('edit', staffObj);
        });

        // Click xóa nhân viên
        $(".btnDeleteStaff").click(function() {
            const id = $(this).data("id");
            confirmDeleteStaff(id);
        });
    }

    // Modal Thêm/Sửa Nhân viên
    $("#btnCreateStaff").click(function() {
        showStaffModal('add');
    });

    function showStaffModal(action, staffData = null) {
        const title = action === 'add' ? 'Thêm Tài Khoản Nhân Viên' : 'Chỉnh Sửa Tài Khoản';
        const hotenVal = staffData ? staffData.HOTENNV : '';
        const tendnVal = staffData ? staffData.TENDN : '';
        const mkVal = staffData ? staffData.MATKHAU : '';
        const mailVal = staffData ? staffData.EMAIL : '';
        const sdtVal = staffData ? staffData.SDT : '';
        const gtVal = staffData ? staffData.GIOITINH : 'Nam';
        const nsVal = staffData ? staffData.NGAYSINH : '2000-01-01';
        const qVal = staffData ? staffData.MAQUYEN : 2;

        Swal.fire({
            title: title,
            html: `
                <div class="grid grid-cols-2 gap-4 text-left">
                    <div class="col-span-2">
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Họ và tên nhân viên</label>
                        <input type="text" id="swalStaffName" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${hotenVal}" placeholder="Nhập họ và tên...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Tên đăng nhập</label>
                        <input type="text" id="swalStaffUser" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${tendnVal}" placeholder="Nhập tên tài khoản...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Mật khẩu</label>
                        <input type="password" id="swalStaffPass" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${mkVal}" placeholder="Nhập mật khẩu...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Số điện thoại</label>
                        <input type="text" id="swalStaffPhone" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${sdtVal}" placeholder="Nhập SĐT...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-455 dark:text-slate-400 mb-1">Email</label>
                        <input type="email" id="swalStaffEmail" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${mailVal}" placeholder="Nhập email...">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Giới tính</label>
                        <select id="swalStaffGender" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold">
                            <option value="Nam" ${gtVal === 'Nam' ? 'selected' : ''}>Nam</option>
                            <option value="Nữ" ${gtVal === 'Nữ' ? 'selected' : ''}>Nữ</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Ngày sinh</label>
                        <input type="date" id="swalStaffBirth" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold" value="${nsVal}">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-xs font-semibold text-slate-450 dark:text-slate-400 mb-1">Vai trò quyền</label>
                        <select id="swalStaffRole" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-gold">
                            <option value="1" ${qVal == 1 ? 'selected' : ''}>Quản lý (Admin)</option>
                            <option value="2" ${qVal == 2 ? 'selected' : ''}>Nhân viên phục vụ</option>
                            <option value="3" ${qVal == 3 ? 'selected' : ''}>Thu ngân (Cashier)</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#d4af37',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Lưu lại',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor(),
            preConfirm: () => {
                const hoten = $("#swalStaffName").val().trim();
                const tendn = $("#swalStaffUser").val().trim();
                const matkhau = $("#swalStaffPass").val().trim();
                const sdt = $("#swalStaffPhone").val().trim();
                const email = $("#swalStaffEmail").val().trim();
                const gioitinh = $("#swalStaffGender").val();
                const ngaysinh = $("#swalStaffBirth").val();
                const maquyen = $("#swalStaffRole").val();

                if (!hoten || !tendn || !matkhau) {
                    Swal.showValidationMessage('Họ tên, tài khoản và mật khẩu là bắt buộc!');
                    return false;
                }
                
                return {
                    hoten: hoten,
                    tendn: tendn,
                    matkhau: matkhau,
                    sdt: sdt,
                    email: email,
                    gioitinh: gioitinh,
                    ngaysinh: ngaysinh,
                    maquyen: maquyen
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const payload = {
                    action: action,
                    ...result.value
                };
                if (action === 'edit') {
                    payload.manv = staffData.MANV;
                }

                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_staff.php",
                    type: "POST",
                    data: payload,
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Thành công!', timer: 1500, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            loadStaffs();
                        } else {
                            Swal.fire({ icon: 'error', title: 'Lỗi', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

    function confirmDeleteStaff(staffId) {
        // Bảo vệ không tự xóa chính mình
        if (parseInt(staffId) === parseInt(manv)) {
            Swal.fire({
                icon: 'error',
                title: 'Không thể xóa!',
                text: 'Bạn không thể xóa tài khoản Admin đang đăng nhập hệ thống.',
                background: getSwalBg(),
                color: getSwalColor()
            });
            return;
        }

        Swal.fire({
            title: 'Xóa tài khoản này?',
            text: 'Tài khoản nhân viên này sẽ bị xóa khỏi hệ thống cơ sở dữ liệu!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý xóa',
            cancelButtonText: 'Hủy',
            background: getSwalBg(),
            color: getSwalColor()
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: CONFIG.BASE_URL + "api/update_staff.php",
                    type: "POST",
                    data: { action: 'delete', manv: staffId },
                    dataType: "json",
                    success: function(res) {
                        if (res.status === "success") {
                            Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1200, background: getSwalBg(), color: getSwalColor(), showConfirmButton: false });
                            loadStaffs();
                        } else {
                            Swal.fire({ icon: 'error', title: 'Thất bại', text: res.message, background: getSwalBg(), color: getSwalColor() });
                        }
                    }
                });
            }
        });
    }

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
    // 🔔 NOTIFICATION MODULE — Real-time Polling
    // =============================================
    let knownOrderIds = new Set(); // Lưu mã đơn đã biết để phát hiện đơn mới
    let notifList = [];            // Danh sách thông báo hiển thị trong panel
    let unreadCount = 0;
    let notifPanelOpen = false;

    // Khởi tạo: Load đơn hôm nay lần đầu (không thông báo, chỉ đánh dấu "đã biết")
    function initNotifications() {
        $.ajax({
            url: CONFIG.BASE_URL + 'api/get_paid_orders.php',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                if (!Array.isArray(data)) return;
                const today = getTodayStr();
                data.filter(o => o.NGAYDAT && o.NGAYDAT.startsWith(today))
                    .forEach(o => knownOrderIds.add(parseInt(o.MADONDAT)));
            }
        });
    }

    // Polling mỗi 10 giây để kiểm tra đơn mới
    function pollNotifications() {
        $.ajax({
            url: CONFIG.BASE_URL + 'api/get_paid_orders.php',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                if (!Array.isArray(data)) return;
                const today = getTodayStr();
                const todayOrders = data.filter(o => o.NGAYDAT && o.NGAYDAT.startsWith(today));

                // Tìm đơn mới (chưa có trong knownOrderIds)
                const newOrders = todayOrders.filter(o => !knownOrderIds.has(parseInt(o.MADONDAT)));

                newOrders.forEach(order => {
                    knownOrderIds.add(parseInt(order.MADONDAT));
                    addNotification(order);
                });
            }
        });
    }

    // Thêm 1 thông báo mới vào hệ thống
    function addNotification(order) {
        const notif = {
            id: order.MADONDAT,
            tenBan: order.TENBAN,
            tongTien: order.TONGTIEN,
            nhanVien: order.HOTENNV,
            phuongThuc: order.PHUONGTHUCTT || 'Tiền mặt',
            thoiGian: order.NGAYDAT ? order.NGAYDAT.split(' ')[1].substring(0, 5) : '--:--',
            read: false
        };

        notifList.unshift(notif); // Thêm vào đầu danh sách
        unreadCount++;

        updateBadge();
        renderNotifPanel();
        showToast(notif);
    }

    // Cập nhật badge số trên nút chuông
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
            const isTransfer = n.phuongThuc === 'Chuyển khoản';
            const readClass = n.read ? 'opacity-60' : '';
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
    setInterval(pollNotifications, 10000);

});

