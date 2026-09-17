/**
 * SocketBus — bọc Socket.IO thành một đầu mối duy nhất cho cả trang.
 *
 * VÌ SAO CÓ LỚP NÀY
 * -----------------
 * Trước đây mỗi trang tự dựng kết nối và tự suy ra địa chỉ máy chủ:
 *
 *     let socketUrl = window.location.origin.replace(":8081", "");
 *     if (hostname === 'localhost') socketUrl = 'http://103.157.204.120';
 *
 * Đoạn này lặp ở ba tệp, ghi cứng IP của một máy chủ nay đã bị hủy, và
 * kích hoạt đúng khi chạy ở môi trường local — nên phần realtime chết
 * ngay khi phát triển. Gom về một lớp thì đổi quy ước chỉ phải sửa một chỗ.
 *
 * Lớp này còn giải quyết một vấn đề của cách viết cũ: mỗi lần vẽ lại giao
 * diện, code cũ đăng ký thêm listener mà không hủy listener cũ, nên cùng
 * một sự kiện dần bị xử lý nhiều lần. Phương thức nghe() ở đây trả về hàm
 * hủy đăng ký, và ngungTatCa() dọn sạch khi rời màn hình.
 */
export class SocketBus {

    static _socket = null;
    static _dangDangKy = [];

    /**
     * Kết nối tới máy chủ realtime.
     * @param {string} vaiTro 'admin' | 'cashier' | 'customer'
     * @param {number} maKhachHang Chỉ dùng khi vaiTro là 'customer'
     */
    static ketNoi(vaiTro, maKhachHang = null) {
        if (SocketBus._socket) return SocketBus._socket;

        if (typeof io === 'undefined') {
            console.warn('[SocketBus] Thư viện socket.io chưa được nạp — bỏ qua realtime.');
            return null;
        }

        // Socket.IO đi qua CÙNG origin với trang. Apache chuyển tiếp
        // /socket.io/ sang container resto-socket, xử lý cả long-polling
        // lẫn nâng cấp WebSocket.
        const diaChi = window.location.protocol === 'file:'
            ? 'http://localhost:8000'
            : window.location.origin;

        SocketBus._socket = io(diaChi, { path: '/socket.io/' });

        SocketBus._socket.on('connect', () => {
            console.log('🔌 Socket đã kết nối:', SocketBus._socket.id);
            // Vào phòng theo vai trò. Máy chủ dựa vào đây để gửi đúng dữ
            // liệu, và để đồng bộ trạng thái ngay lúc kết nối — cơ chế vá
            // lỗi mất sự kiện khi offline (xem QĐ-016).
            if (vaiTro === 'customer' && maKhachHang) {
                SocketBus._socket.emit('join_customer', maKhachHang);
            } else if (vaiTro === 'cashier') {
                SocketBus._socket.emit('join_cashier');
            } else {
                SocketBus._socket.emit('join_admin');
            }
        });

        SocketBus._socket.on('disconnect', (lyDo) => {
            console.log('❌ Socket ngắt kết nối:', lyDo, '— sẽ tự kết nối lại');
        });

        return SocketBus._socket;
    }

    /**
     * Đăng ký lắng nghe một sự kiện.
     * @returns {Function} Hàm hủy đăng ký — gọi khi rời màn hình.
     */
    static nghe(tenSuKien, xuLy) {
        if (!SocketBus._socket) return () => {};
        SocketBus._socket.on(tenSuKien, xuLy);
        SocketBus._dangDangKy.push({ tenSuKien, xuLy });
        return () => SocketBus.ngung(tenSuKien, xuLy);
    }

    static ngung(tenSuKien, xuLy) {
        if (!SocketBus._socket) return;
        SocketBus._socket.off(tenSuKien, xuLy);
        SocketBus._dangDangKy = SocketBus._dangDangKy.filter(
            d => !(d.tenSuKien === tenSuKien && d.xuLy === xuLy)
        );
    }

    /** Hủy toàn bộ đăng ký. Dùng khi chuyển tab để tránh xử lý chồng chéo. */
    static ngungTatCa() {
        if (!SocketBus._socket) return;
        SocketBus._dangDangKy.forEach(({ tenSuKien, xuLy }) => {
            SocketBus._socket.off(tenSuKien, xuLy);
        });
        SocketBus._dangDangKy = [];
    }

    /**
     * Phát sự kiện.
     *
     * Trong giai đoạn chuyển đổi, trang quản trị vẫn còn kết nối socket
     * riêng do js/admin.js quản lý. Nếu lớp này cũng tự kết nối thì một
     * trang sẽ có hai kết nối tới cùng máy chủ — tốn tài nguyên và làm log
     * phía server khó đọc.
     *
     * Nên khi chưa có socket riêng, ta phát một sự kiện DOM để phần mã cũ
     * chuyển tiếp giúp. Khi toàn bộ màn hình đã chuyển sang lớp mới,
     * nhánh dự phòng này bỏ đi được.
     */
    static phat(tenSuKien, duLieu = undefined) {
        if (SocketBus._socket && SocketBus._socket.connected) {
            SocketBus._socket.emit(tenSuKien, duLieu);
            return;
        }
        document.dispatchEvent(new CustomEvent('admin:socket-phat', {
            detail: { tenSuKien, duLieu }
        }));
    }

    /** Phát nhiều sự kiện cùng lúc — thao tác ghi thường cần báo vài loại. */
    static phatNhieu(danhSachSuKien) {
        (danhSachSuKien || []).forEach(ten => SocketBus.phat(ten));
    }

    static get daKetNoi() {
        return !!(SocketBus._socket && SocketBus._socket.connected);
    }
}
