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

// ---------------------------------------------------------------------
// Bảo trì và thông báo hệ thống từ bảng điều khiển máy chủ (QĐ-107)
// ---------------------------------------------------------------------
// Khi bảo trì, Caddy trả 503 kèm header X-Bao-Tri cho mọi lời gọi /api/ và
// trả trang bảo trì thay cho mọi trang. Chỉ cần tải lại: trình duyệt nhận
// trang bảo trì, trang đó tự mở lại khi hết bảo trì.
$(document).ajaxError(function (event, jqxhr) {
    if (jqxhr.status === 503 && jqxhr.getResponseHeader('X-Bao-Tri')) {
        window.location.reload();
    }
});

window.RoyalHeThong = {
    /** Gắn hai sự kiện của bảng điều khiển vào socket của trang (admin.js, cashier.html). */
    ganSocket: function (socket) {
        socket.on('bao_tri', function (tt) {
            if (tt && tt.bat) window.location.reload();
        });
        socket.on('thong_bao_he_thong', function (tb) {
            if (tb && tb.noi_dung) RoyalHeThong.hienThongBao(tb.noi_dung, tb.muc_do === 'canh_bao');
        });
    },

    /**
     * Dải thông báo trên đầu trang. Cố ý KHÔNG dùng Swal: Swal chỉ có một hộp
     * tại một thời điểm, gọi Swal.fire sẽ đóng mất hộp nhân viên đang nhập dở.
     */
    hienThongBao: function (noiDung, canhBao) {
        var cu = document.getElementById('royalThongBaoHeThong');
        if (cu) cu.remove();
        var dai = document.createElement('div');
        dai.id = 'royalThongBaoHeThong';
        dai.setAttribute('role', 'alert');
        dai.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;'
            + 'max-width:min(640px,calc(100vw - 32px));display:flex;gap:12px;align-items:flex-start;'
            + 'padding:14px 16px;border-radius:14px;background:#141416;color:#ece7da;'
            + 'box-shadow:0 18px 50px rgba(0,0,0,.55);font:14px/1.5 "Segoe UI",Roboto,sans-serif;'
            + 'border:1px solid ' + (canhBao ? 'rgba(240,168,75,.7)' : 'rgba(212,175,55,.5)') + ';';
        var noi = document.createElement('div');
        var tieuDe = document.createElement('div');
        tieuDe.style.cssText = 'font-weight:700;margin-bottom:2px;color:' + (canhBao ? '#f0a84b' : '#d4af37');
        tieuDe.textContent = canhBao ? 'Cảnh báo từ quản trị hệ thống' : 'Thông báo hệ thống';
        var than = document.createElement('div');
        than.style.whiteSpace = 'pre-line';
        than.textContent = noiDung;
        noi.appendChild(tieuDe);
        noi.appendChild(than);
        var dong = document.createElement('button');
        dong.type = 'button';
        dong.textContent = 'Đã hiểu';
        dong.style.cssText = 'margin-left:auto;flex:none;cursor:pointer;border:1px solid rgba(212,175,55,.5);'
            + 'background:transparent;color:#f3e5ab;border-radius:8px;padding:4px 10px;font:inherit;';
        dong.onclick = function () { dai.remove(); };
        dai.appendChild(noi);
        dai.appendChild(dong);
        document.body.appendChild(dai);
        // Thông tin tự ẩn; cảnh báo giữ tới khi bấm "Đã hiểu".
        if (!canhBao) setTimeout(function () { dai.remove(); }, 20000);
    }
};
