// =====================================================================
// Cấu hình chung cho Web Portal
// =====================================================================
// Tệp này được nạp ngay sau jQuery ở cả ba trang (index / admin / cashier)
// nên là nơi thích hợp để cài đặt phần xử lý dùng chung cho mọi lời gọi API.

const CONFIG = {
    BASE_URL: "/api/"
};

// ---------------------------------------------------------------------
// Tự động đính kèm thông tin phiên vào MỌI lời gọi AJAX
// ---------------------------------------------------------------------
// Tầng xác thực phía máy chủ (api/require_auth.php) đọc hai header
// X-Manv và X-Token. Cài ở đây một lần là toàn bộ hơn 30 lời gọi trong
// admin.js và cashier.html đều được đính kèm, không phải sửa từng chỗ.
//
// Dùng beforeSend chứ không dùng headers tĩnh: giá trị phải được đọc tại
// thời điểm gửi yêu cầu, vì token thay đổi sau mỗi lần đăng nhập.
$.ajaxSetup({
    beforeSend: function (xhr) {
        try {
            const manv  = localStorage.getItem('manv');
            const token = localStorage.getItem('token');
            if (manv && token) {
                xhr.setRequestHeader('X-Manv', manv);
                xhr.setRequestHeader('X-Token', token);
            }
        } catch (e) {
            // Trình duyệt chặn localStorage (chế độ ẩn danh chẳng hạn).
            // Không chặn yêu cầu — để máy chủ tự quyết định từ chối.
        }
    }
});

// ---------------------------------------------------------------------
// Xử lý tập trung khi phiên hết hiệu lực
// ---------------------------------------------------------------------
// Máy chủ trả 401 khi thiếu token hoặc token sai. Không bắt ở đây thì
// mỗi lời gọi sẽ lặng lẽ thất bại và giao diện chỉ hiện dữ liệu trống —
// người dùng không hiểu vì sao.
$(document).ajaxError(function (event, jqxhr) {
    if (jqxhr.status !== 401) return;

    // Trên chính trang đăng nhập thì không điều hướng, tránh vòng lặp.
    const dangODangNhap = /(^|\/)(index\.html)?$/.test(window.location.pathname.split('/').pop() || '');
    if (dangODangNhap) return;

    try {
        localStorage.removeItem('manv');
        localStorage.removeItem('token');
    } catch (e) { /* bỏ qua */ }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Phiên đăng nhập đã hết hạn',
            text: 'Vui lòng đăng nhập lại để tiếp tục.',
            allowOutsideClick: false,
            confirmButtonText: 'Đăng nhập lại'
        }).then(function () {
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
});
