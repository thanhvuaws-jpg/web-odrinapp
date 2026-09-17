/**
 * Dialog — bọc SweetAlert2 để mọi hộp thoại có màu khớp với chủ đề sáng/tối.
 *
 * Trước đây mỗi lần gọi Swal.fire đều phải tự truyền background và color:
 *     Swal.fire({ ..., background: getSwalBg(), color: getSwalColor() })
 * Riêng admin.js có hơn 25 lời gọi như vậy. Quên một chỗ là hộp thoại đó
 * lạc tông so với phần còn lại — lỗi nhỏ nhưng rất dễ mắc và khó rà.
 */
export class Dialog {

    /** Màu nền theo chủ đề hiện tại. */
    static _nen() {
        return document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff';
    }

    /** Màu chữ theo chủ đề hiện tại. */
    static _chu() {
        return document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a';
    }

    static _chung(themVao = {}) {
        return Object.assign({
            background: Dialog._nen(),
            color: Dialog._chu(),
            confirmButtonColor: '#D4AF37'
        }, themVao);
    }

    /** Thông báo thành công, tự đóng sau 1,2 giây. */
    static thanhCong(tieuDe, noiDung = '') {
        return Swal.fire(Dialog._chung({
            icon: 'success',
            title: tieuDe,
            text: noiDung,
            timer: 1200,
            showConfirmButton: false
        }));
    }

    static loi(tieuDe, noiDung = '') {
        return Swal.fire(Dialog._chung({ icon: 'error', title: tieuDe, text: noiDung }));
    }

    static canhBao(tieuDe, noiDung = '') {
        return Swal.fire(Dialog._chung({ icon: 'warning', title: tieuDe, text: noiDung }));
    }

    /**
     * Hỏi xác nhận cho thao tác nguy hiểm (xóa dữ liệu).
     * @returns {Promise<boolean>} true nếu người dùng đồng ý
     */
    static async xacNhanXoa(tieuDe, noiDung) {
        const kq = await Swal.fire(Dialog._chung({
            icon: 'warning',
            title: tieuDe,
            text: noiDung,
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Đồng ý xóa',
            cancelButtonText: 'Hủy'
        }));
        return kq.isConfirmed;
    }

    /**
     * Hỏi xác nhận cho thao tác KHÔNG phá hủy dữ liệu.
     *
     * Tách khỏi xacNhanXoa() vì hàm kia ghi cứng nhãn "Đồng ý xóa" và nút
     * màu đỏ — đúng cho việc xóa, nhưng sai ngữ cảnh với những thao tác có
     * thể hoàn tác như chuyển bàn sang bảo trì. Nhãn nút sai làm người
     * dùng do dự hoặc hiểu nhầm hậu quả.
     *
     * @param {string} nhanNut Nhãn nút xác nhận, ví dụ 'Chuyển bảo trì'
     */
    static async xacNhan(tieuDe, noiDung, nhanNut = 'Đồng ý') {
        const kq = await Swal.fire(Dialog._chung({
            icon: 'question',
            title: tieuDe,
            text: noiDung,
            showCancelButton: true,
            confirmButtonColor: '#D4AF37',
            cancelButtonColor: '#334155',
            confirmButtonText: nhanNut,
            cancelButtonText: 'Hủy'
        }));
        return kq.isConfirmed;
    }

    /**
     * Hộp thoại biểu mẫu.
     * @param {string} tieuDe
     * @param {string} html        Nội dung biểu mẫu
     * @param {Function} docGiaTri Hàm đọc giá trị khi bấm xác nhận;
     *                             trả về null để chặn đóng (dữ liệu chưa hợp lệ)
     * @returns {Promise<object|null>}
     */
    static async bieuMau(tieuDe, html, docGiaTri) {
        const kq = await Swal.fire(Dialog._chung({
            title: tieuDe,
            html,
            showCancelButton: true,
            confirmButtonText: 'Lưu',
            cancelButtonText: 'Hủy',
            focusConfirm: false,
            width: 520,
            preConfirm: docGiaTri
        }));
        return kq.isConfirmed ? kq.value : null;
    }

    /** Báo lỗi từ ApiClient, tự lấy thông báo tiếng Việt máy chủ đã soạn. */
    static loiApi(e) {
        // Lỗi 401 đã được ApiClient xử lý (hiện hộp thoại + chuyển trang),
        // nên ở đây bỏ qua để tránh hiện hai hộp thoại chồng nhau.
        if (e && e.maHttp === 401) return;
        Dialog.loi('Thất bại', (e && e.message) || 'Đã xảy ra lỗi.');
    }
}
