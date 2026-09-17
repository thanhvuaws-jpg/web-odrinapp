import { CrudScreen } from './CrudScreen.js';
import { Formatter }  from '../core/Formatter.js';

/**
 * CategoryScreen — màn hình quản lý danh mục thực đơn (bảng LOAIMON).
 *
 * Toàn bộ hành vi — nạp, vẽ bảng, mở biểu mẫu, xác nhận xóa, phát sự kiện
 * socket, nạp lại — đều nằm ở lớp cơ sở CrudScreen. Lớp này chỉ khai báo
 * phần KHÁC BIỆT của danh mục.
 *
 * Đối chiếu: phiên bản cũ trong js/admin.js cần bốn hàm và khoảng 300 dòng
 * (loadCategories, renderCategories, showCategoryModal, confirmDeleteCategory)
 * để làm đúng những việc này.
 */
export class CategoryScreen extends CrudScreen {

    get tenHienThi()       { return 'danh mục'; }
    get endpointDanhSach() { return 'get_categories.php'; }
    get endpointGhi()      { return 'update_category.php'; }
    get khoaChinh()        { return 'maloai'; }
    /** Dùng đúng phần tử đã có sẵn trong admin.html, không đổi bố cục. */
    get selectorBang()     { return '#categoriesList'; }

    /**
     * @param {Function} khiChon Gọi lại khi người dùng chọn một danh mục,
     *                           để màn hình Món ăn lọc theo danh mục đó.
     */
    constructor(khiChon = null) {
        super();
        this.khiChon = khiChon;
        this.danhMucDangChon = null;
    }

    /**
     * Đổi danh mục làm thay đổi thực đơn, nên phải báo cho cả ứng dụng
     * Android (đang nghe 'menu_changed') chứ không chỉ các trang web.
     */
    suKienSauKhiGhi() { return ['refresh_orders', 'menu_changed']; }

    /** Tự nạp lại khi người khác sửa thực đơn từ thiết bị khác. */
    suKienCanNghe() { return ['menu_changed']; }

    /** Không dùng — màn hình này vẽ danh sách thẻ, không vẽ bảng. */
    cotBang() { return []; }

    /**
     * Ghi đè cách vẽ: danh mục hiển thị dạng danh sách thẻ ở cột bên, có
     * thể bấm chọn để lọc bảng món ăn — không phải bảng như mặc định của
     * lớp cơ sở.
     *
     * Giữ nguyên lớp CSS của giao diện cũ để trông không khác gì trước.
     */
    veNoiDung(duLieu) {
        return duLieu.map(c => {
            const dangChon = this.danhMucDangChon
                          && String(this.danhMucDangChon.MALOAI) === String(c.MALOAI);

            const anh = c.HINHANH
                ? Formatter.an(c.HINHANH)
                : 'https://placehold.co/80x80?text=Menu';

            const lopThe = dangChon
                ? 'border-gold bg-slate-100/80 dark:bg-slate-900/40 text-gold font-bold shadow-sm shadow-gold/5'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300';

            return `
                <div class="the-danh-muc flex items-center justify-between p-3 rounded-xl cursor-pointer
                            hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-all border ${lopThe}"
                     data-id="${Formatter.an(c.MALOAI)}">
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                        <img class="w-10 h-10 rounded-lg object-cover" src="${anh}"
                             alt="${Formatter.an(c.TENLOAI)}" loading="lazy"
                             onerror="this.src='https://placehold.co/80x80?text=Menu'">
                        <span class="truncate text-sm">${Formatter.an(c.TENLOAI)}</span>
                    </div>
                    <div class="flex items-center space-x-1 pl-2">
                        <button class="nut-sua p-1 text-slate-400 hover:text-gold transition-colors"
                                data-id="${Formatter.an(c.MALOAI)}" title="Sửa">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button class="nut-xoa p-1 text-slate-400 hover:text-red-400 transition-colors"
                                data-id="${Formatter.an(c.MALOAI)}" title="Xóa">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');
    }

    /** Bấm vào thẻ (ngoài hai nút) thì chọn danh mục đó. */
    ganSuKienRieng(suKien) {
        const the = suKien.target.closest('.the-danh-muc');
        if (!the) return;

        const banGhi = this._timBanGhi(the.dataset.id);
        if (!banGhi) return;

        this.danhMucDangChon = banGhi;
        this.ve();                       // vẽ lại để cập nhật trạng thái đang chọn
        if (this.khiChon) this.khiChon(banGhi);
    }

    /** Sau khi nạp lại, giữ nguyên danh mục đang chọn nếu nó còn tồn tại. */
    docDuLieu(phanHoi) {
        const ds = Array.isArray(phanHoi) ? phanHoi : (phanHoi && phanHoi.data) || [];
        if (this.danhMucDangChon) {
            const conTonTai = ds.find(
                c => String(c.MALOAI) === String(this.danhMucDangChon.MALOAI)
            );
            this.danhMucDangChon = conTonTai || null;
        }
        // Chưa chọn gì thì tự chọn danh mục đầu tiên, để bảng món không trống
        if (!this.danhMucDangChon && ds.length) {
            this.danhMucDangChon = ds[0];
            if (this.khiChon) setTimeout(() => this.khiChon(ds[0]), 0);
        }
        return ds;
    }

    truongForm(banGhi) {
        return [
            {
                ten: 'tenloai',
                nhan: 'Tên danh mục',
                kieu: 'text',
                batBuoc: true,
                giaTri: banGhi ? banGhi.TENLOAI : '',
                kiemTra: (v) => v.length > 255 ? 'Tên danh mục quá dài (tối đa 255 ký tự)' : null
            },
            {
                ten: 'hinhanh',
                nhan: banGhi ? 'Ảnh mới (bỏ trống nếu giữ ảnh cũ)' : 'Ảnh danh mục',
                kieu: 'file'
            }
        ];
    }

    canhBaoXoa() {
        return 'Hãy chắc chắn không còn món ăn nào thuộc danh mục này, '
             + 'nếu không thao tác sẽ bị cơ sở dữ liệu từ chối.';
    }

    /**
     * Máy chủ nhận ảnh dưới dạng chuỗi base64 qua tham số 'hinhanh'
     * (xem api/update_category.php dòng 19), nên phải đọc tệp trước khi gửi.
     * Bỏ trống thì không gửi trường này, và máy chủ giữ nguyên ảnh cũ.
     */
    async chuanBiDuLieuGui(duLieuForm) {
        const goiTin = { ...duLieuForm };
        if (goiTin.hinhanh instanceof File) {
            goiTin.hinhanh = await CategoryScreen._docTepThanhBase64(goiTin.hinhanh);
        } else {
            delete goiTin.hinhanh;
        }
        return goiTin;
    }

    static _docTepThanhBase64(tep) {
        return new Promise((thanhCong, thatBai) => {
            const doc = new FileReader();
            doc.onload = () => thanhCong(doc.result);
            doc.onerror = () => thatBai(new Error('Không đọc được tệp ảnh'));
            doc.readAsDataURL(tep);
        });
    }
}
