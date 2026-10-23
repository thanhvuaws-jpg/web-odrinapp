$(document).ready(function() {
    // Giao diện Sơn Son chỉ có một bản sáng (xem js/son-son-mau.js); xóa lựa
    // chọn sáng/tối còn sót từ bản cũ để trang quản trị không bị lệch màu.
    localStorage.removeItem("theme");

    // Ghi nhớ tên đăng nhập trên máy này — chỉ tên, không bao giờ lưu mật khẩu.
    const KHOA_NHO_TEN = "tendn_ghi_nho";
    const tenDaNho = localStorage.getItem(KHOA_NHO_TEN);
    if (tenDaNho) {
        $("#username").val(tenDaNho);
        $("#nhoTenDangNhap").prop("checked", true);
    }

    // Tài khoản nhân sự do quản lý cấp, nên quên mật khẩu thì nhờ quản lý
    // đặt lại ở mục Nhân viên — không có đường tự khôi phục trên web.
    $("#quenMatKhau").click(function(e) {
        e.preventDefault();
        Swal.fire({
            icon: 'info',
            title: 'Quên mật khẩu?',
            text: 'Hãy nhờ quản lý nhà hàng đặt lại mật khẩu cho bạn ở mục Nhân viên trên trang quản trị.',
            confirmButtonText: 'Đã hiểu'
        });
    });

    // Kiểm tra xem đã đăng nhập chưa
    const userRole = localStorage.getItem("maquyen");
    if (userRole) {
        redirectByRole(parseInt(userRole));
    }

    // Nút ẩn hiện mật khẩu
    $("#togglePassword").click(function() {
        const passwordInput = $("#password");
        const icon = $(this).find("i");
        if (passwordInput.attr("type") === "password") {
            passwordInput.attr("type", "text");
            icon.removeClass("fa-eye").addClass("fa-eye-slash");
        } else {
            passwordInput.attr("type", "password");
            icon.removeClass("fa-eye-slash").addClass("fa-eye");
        }
    });

    // Form submit đăng nhập
    $("#loginForm").submit(function(e) {
        e.preventDefault();

        const username = $("#username").val().trim();
        const password = $("#password").val().trim();

        // Form đặt novalidate để không hiện bong bóng mặc định của trình
        // duyệt; tự báo bằng hộp thoại cùng kiểu với phần còn lại.
        if (!username || !password) {
            Swal.fire({
                icon: 'warning',
                title: 'Thiếu thông tin',
                text: !username ? 'Vui lòng nhập tên đăng nhập.' : 'Vui lòng nhập mật khẩu.',
                confirmButtonText: 'Nhập lại'
            }).then(() => $(!username ? "#username" : "#password").trigger("focus"));
            return;
        }

        Swal.fire({
            title: 'Đang xử lý...',
            html: 'Vui lòng chờ trong giây lát',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        $.ajax({
            url: CONFIG.BASE_URL + "api/login.php",
            type: "POST",
            data: {
                tendn: username,
                matkhau: password
            },
            dataType: "json",
            success: function(response) {
                Swal.close();
                if (response.status === "success") {
                    const role = parseInt(response.MAQUYEN);
                    
                    // Phân quyền trên Web
                    if (role === 1 || role === 3) {
                        localStorage.setItem("manv", response.MANV);
                        localStorage.setItem("hoten", response.HOTENNV);
                        localStorage.setItem("maquyen", response.MAQUYEN);
                        localStorage.setItem("token", response.TOKEN);
                        if ($("#nhoTenDangNhap").is(":checked")) {
                            localStorage.setItem(KHOA_NHO_TEN, username);
                        } else {
                            localStorage.removeItem(KHOA_NHO_TEN);
                        }

                        Swal.fire({
                            icon: 'success',
                            title: 'Thành công!',
                            text: 'Đăng nhập hệ thống thành công.',
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => {
                            redirectByRole(role);
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Từ chối truy cập!',
                            text: 'Tài khoản nhân viên phục vụ chỉ sử dụng trên App Android.',
                            confirmButtonText: 'Đã hiểu'
                        });
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Đăng nhập thất bại',
                        text: response.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
                        confirmButtonText: 'Thử lại'
                    });
                }
            },
            error: function(xhr, status, error) {
                Swal.close();
                Swal.fire({
                    icon: 'error',
                    title: 'Lỗi kết nối',
                    text: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc VPS.',
                    confirmButtonText: 'Đóng'
                });
            }
        });
    });

    function redirectByRole(role) {
        if (role === 1) {
            window.location.href = "admin.html";
        } else if (role === 3) {
            window.location.href = "cashier.html";
        }
    }
});
