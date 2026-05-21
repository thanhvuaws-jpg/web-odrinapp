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
            $("html").removeClass("dark").addClass("light");
        } else {
            $("html").addClass("dark").removeClass("light");
        }
    }

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

        const isDark = $("html").hasClass("dark");
        Swal.fire({
            title: 'Đang xử lý...',
            html: 'Vui lòng chờ trong giây lát',
            allowOutsideClick: false,
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
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

                        Swal.fire({
                            icon: 'success',
                            title: 'Thành công!',
                            text: 'Đăng nhập hệ thống thành công.',
                            timer: 1500,
                            background: isDark ? '#0f172a' : '#ffffff',
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            showConfirmButton: false
                        }).then(() => {
                            redirectByRole(role);
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Từ chối truy cập!',
                            text: 'Tài khoản nhân viên phục vụ chỉ sử dụng trên App Android.',
                            background: isDark ? '#0f172a' : '#ffffff',
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            confirmButtonText: 'Đã hiểu'
                        });
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Đăng nhập thất bại',
                        text: response.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
                        background: isDark ? '#0f172a' : '#ffffff',
                        color: isDark ? '#f1f5f9' : '#0f172a',
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
                    background: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
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
