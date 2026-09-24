import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';
import { SocketBus } from '../core/SocketBus.js';

/**
 * CrudScreen — lớp cơ sở cho mọi màn hình quản lý danh sách.
 *
 * ============================================================
 * VẤN ĐỀ LỚP NÀY GIẢI QUYẾT
 * ============================================================
 * Trong js/admin.js có ba bộ hàm gần như giống hệt nhau:
 *
 *   Danh mục : loadCategories / renderCategories / showCategoryModal /
 *              confirmDeleteCategory
 *   Món ăn   : loadDishes     / renderDishes     / showDishModal /
 *              confirmDeleteDish
 *   Nhân viên: loadStaffs     / renderStaffs     / showStaffModal /
 *              confirmDeleteStaff
 *
 * Đã so từng dòng hai hàm xóa: chúng chỉ khác nhau đúng năm thứ — chuỗi
 * tiêu đề, tên tệp endpoint, tên khóa chính, hàm nạp lại, và danh sách sự
 * kiện socket phát ra. Khoảng 900 dòng là biến thể của cùng một khuôn.
 *
 * ============================================================
 * CÁCH DÙNG — MẪU PHƯƠNG THỨC KHUÔN (Template Method)
 * ============================================================
 * Lớp cơ sở nắm TRÌNH TỰ xử lý (nạp, vẽ, mở form, xác nhận, ghi, báo
 * socket, nạp lại). Lớp con chỉ khai báo phần DỮ LIỆU khác nhau:
 *
 *     class ManHinhDanhMuc extends CrudScreen {
 *         get tenHienThi()      { return 'danh mục'; }
 *         get endpointDanhSach(){ return 'get_categories.php'; }
 *         get endpointGhi()     { return 'update_category.php'; }
 *         get khoaChinh()       { return 'maloai'; }
 *         get selectorBang()    { return '#bangDanhMuc'; }
 *         cotBang()   { return [ { ten: 'TENLOAI', nhan: 'Tên danh mục' } ]; }
 *         truongForm(bg) { return [ { ten:'tenloai', nhan:'Tên danh mục',
 *                                     kieu:'text', giaTri: bg?.TENLOAI } ]; }
 *     }
 *
 * Nhờ vậy thêm một màn hình quản lý mới chỉ tốn khoảng 60 dòng khai báo,
 * thay vì 300 dòng sao chép.
 */
export class CrudScreen {

    constructor() {
        this.duLieu = [];
        this._khungDaGan = null;
        this._huyDangKySocket = [];
    }

    /* ==================================================================
     * PHẦN LỚP CON BẮT BUỘC KHAI BÁO
     * ================================================================== */

    /** Tên gọi dùng trong thông báo, ví dụ 'danh mục', 'món ăn'. */
    get tenHienThi() { throw new Error('Lớp con phải khai báo tenHienThi'); }

    /** Tệp PHP lấy danh sách, ví dụ 'get_categories.php'. */
    get endpointDanhSach() { throw new Error('Lớp con phải khai báo endpointDanhSach'); }

    /** Tệp PHP thêm/sửa/xóa, ví dụ 'update_category.php'. */
    get endpointGhi() { throw new Error('Lớp con phải khai báo endpointGhi'); }

    /** Tên khóa chính gửi lên máy chủ, ví dụ 'maloai'. */
    get khoaChinh() { throw new Error('Lớp con phải khai báo khoaChinh'); }

    /** Selector của phần tử chứa danh sách, ví dụ '#bangDanhMuc'. */
    get selectorBang() { throw new Error('Lớp con phải khai báo selectorBang'); }

    /** Định nghĩa các cột hiển thị. */
    cotBang() { throw new Error('Lớp con phải cài đặt cotBang()'); }

    /** Định nghĩa các trường của biểu mẫu thêm/sửa. */
    truongForm(banGhi) { throw new Error('Lớp con phải cài đặt truongForm()'); }

    /* ==================================================================
     * PHẦN LỚP CON CÓ THỂ GHI ĐÈ (có giá trị mặc định hợp lý)
     * ================================================================== */

    /** Sự kiện socket cần phát sau khi ghi dữ liệu thành công. */
    suKienSauKhiGhi() { return ['refresh_orders']; }

    /** Sự kiện socket cần lắng nghe để tự nạp lại. */
    suKienCanNghe() { return []; }

    /** Tham số kèm theo khi gọi endpoint danh sách. */
    thamSoDanhSach() { return null; }

    /** Trích mảng dữ liệu từ phản hồi — một số endpoint bọc trong { data: [...] }. */
    docDuLieu(phanHoi) {
        return Array.isArray(phanHoi) ? phanHoi : (phanHoi && phanHoi.data) || [];
    }

    /**
     * Kiểm tra trước khi xóa. Trả về chuỗi lý do để CHẶN, hoặc null để cho phép.
     * Ví dụ dùng: không cho người dùng tự xóa tài khoản đang đăng nhập.
     */
    kiemTraTruocKhiXoa(banGhi) { return null; }

    /** Câu cảnh báo trong hộp thoại xác nhận xóa. */
    canhBaoXoa(banGhi) { return `Bản ghi ${this.tenHienThi} này sẽ bị xóa khỏi hệ thống.`; }

    /** Chuyển dữ liệu biểu mẫu trước khi gửi (ví dụ đọc tệp ảnh thành base64). */
    async chuanBiDuLieuGui(duLieuForm) { return duLieuForm; }

    /** HTML hiển thị khi danh sách rỗng. */
    htmlRong() {
        return `<div class="py-10 text-center text-slate-400">
                    Chưa có ${Formatter.an(this.tenHienThi)} nào.
                </div>`;
    }

    /* ==================================================================
     * PHẦN LỚP CƠ SỞ CÀI ĐẶT — lớp con không cần viết lại
     * ================================================================== */

    /** Khởi động màn hình: gắn sự kiện, đăng ký socket, nạp dữ liệu. */
    async khoiDong() {
        this._ganSuKien();
        this._dangKySocket();
        await this.nap();
    }

    /** Dọn dẹp khi rời màn hình. */
    dongLai() {
        this._huyDangKySocket.forEach(huy => huy());
        this._huyDangKySocket = [];
    }

    async nap() {
        try {
            const phanHoi = await ApiClient.layDanhSach(
                this.endpointDanhSach, this.thamSoDanhSach()
            );
            this.duLieu = this.docDuLieu(phanHoi);
            this.ve();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /**
     * Vẽ danh sách ra màn hình.
     *
     * Lớp cơ sở chỉ lo TRÌNH TỰ: kiểm tra rỗng rồi giao phần dựng HTML cho
     * veNoiDung(). Không tự áp đặt kiểu bố cục, vì các màn hình có hình
     * dạng khác nhau thật sự — món ăn và nhân viên là bảng, còn danh mục
     * là danh sách thẻ ở cột bên có thể chọn để lọc.
     *
     * Đây là điều chỉnh rút ra khi cài đặt lớp con đầu tiên: bản thiết kế
     * ban đầu ép mọi màn hình phải là bảng, và giả định đó sai ngay ở màn
     * hình thứ nhất.
     */
    ve() {
        const khung = document.querySelector(this.selectorBang);
        if (!khung) return;

        khung.innerHTML = this.duLieu.length
            ? this.veNoiDung(this.duLieu)
            : this.htmlRong();
    }

    /**
     * Dựng HTML cho danh sách. Mặc định là bảng — hợp với phần lớn màn hình
     * quản lý. Lớp con có bố cục khác thì ghi đè toàn bộ phương thức này.
     *
     * Dù ghi đè kiểu gì, nút sửa/xóa phải mang class 'nut-sua' / 'nut-xoa'
     * và thuộc tính data-id, vì cơ chế uỷ quyền sự kiện ở lớp cơ sở dựa vào
     * hai class đó.
     */
    veNoiDung(duLieu) {
        const cot = this.cotBang();
        const dongTieuDe = cot.map(c => `<th class="px-4 py-3 text-left">${Formatter.an(c.nhan)}</th>`).join('');

        const cacDong = duLieu.map(bg => {
            const o = cot.map(c => {
                const giaTri = c.dinhDang ? c.dinhDang(bg[c.ten], bg) : Formatter.an(bg[c.ten]);
                return `<td class="px-4 py-3">${giaTri}</td>`;
            }).join('');
            const id = Formatter.an(bg[this._tenTruongKhoa(bg)]);
            return `<tr data-id="${id}">
                        ${o}
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <button class="nut-sua text-gold-400 hover:text-gold-300 px-2" data-id="${id}" title="Sửa">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="nut-xoa text-red-400 hover:text-red-300 px-2" data-id="${id}" title="Xóa">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
        }).join('');

        return `
            <table class="w-full text-sm">
                <thead class="text-xs uppercase text-slate-400 border-b border-slate-700">
                    <tr>${dongTieuDe}<th class="px-4 py-3"></th></tr>
                </thead>
                <tbody class="divide-y divide-slate-800">${cacDong}</tbody>
            </table>`;
    }

    async moFormThem() {
        await this._moForm('add', null);
    }

    async moFormSua(id) {
        const banGhi = this._timBanGhi(id);
        if (!banGhi) return;
        await this._moForm('edit', banGhi);
    }

    async xacNhanXoa(id) {
        const banGhi = this._timBanGhi(id);
        if (!banGhi) return;

        // Điểm mở rộng cho lớp con: ví dụ chặn tự xóa chính mình.
        const lyDoChan = this.kiemTraTruocKhiXoa(banGhi);
        if (lyDoChan) {
            Dialog.loi('Không thể xóa', lyDoChan);
            return;
        }

        const dongY = await Dialog.xacNhanXoa(
            `Xóa ${this.tenHienThi} này?`, this.canhBaoXoa(banGhi)
        );
        if (!dongY) return;

        try {
            await ApiClient.ghi(this.endpointGhi, {
                action: 'delete',
                [this.khoaChinh]: id
            });
            Dialog.thanhCong('Đã xóa!');
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /* ==================================================================
     * PHẦN NỘI BỘ
     * ================================================================== */

    async _moForm(cheDo, banGhi) {
        const truong = this.truongForm(banGhi);
        const html = truong.map(t => this._veTruong(t)).join('');

        const duLieu = await Dialog.bieuMau(
            cheDo === 'add' ? `Thêm ${this.tenHienThi}` : `Sửa ${this.tenHienThi}`,
            html,
            () => this._docForm(truong)
        );
        if (!duLieu) return;

        try {
            const goiTin = await this.chuanBiDuLieuGui({
                action: cheDo,
                ...duLieu
            });
            if (cheDo === 'edit' && banGhi) {
                goiTin[this.khoaChinh] = banGhi[this._tenTruongKhoa(banGhi)];
            }

            await ApiClient.ghi(this.endpointGhi, goiTin);
            Dialog.thanhCong(cheDo === 'add' ? 'Đã thêm!' : 'Đã cập nhật!');
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    _veTruong(t) {
        const id = 'truong_' + t.ten;
        const nhan = `<label class="block text-left text-xs uppercase tracking-wide mb-1 mt-3">${Formatter.an(t.nhan)}</label>`;
        const lop = 'swal2-input !w-full !mx-0 !mt-0';

        if (t.kieu === 'select') {
            const chon = (t.tuyChon || []).map(o =>
                `<option value="${Formatter.an(o.giaTri)}" ${String(o.giaTri) === String(t.giaTri) ? 'selected' : ''}>
                    ${Formatter.an(o.nhan)}
                 </option>`).join('');
            return `${nhan}<select id="${id}" class="swal2-select !w-full !mx-0 !mt-0">${chon}</select>`;
        }
        if (t.kieu === 'file') {
            return `${nhan}<input id="${id}" type="file" accept="image/*" class="swal2-file !w-full !mx-0 !mt-0">`;
        }
        if (t.kieu === 'textarea') {
            return `${nhan}<textarea id="${id}" class="swal2-textarea !w-full !mx-0 !mt-0">${Formatter.an(t.giaTri ?? '')}</textarea>`;
        }
        // Lưới ảnh bấm để chọn (vd ảnh mẫu của bàn). Mỗi ô là một radio ẩn;
        // ô không có `anh` thì hiện nhãn chữ (vd "Giữ ảnh cũ", "Không ảnh").
        if (t.kieu === 'chonAnh') {
            const o = (t.tuyChon || []).map(o => `
                <label class="cursor-pointer" title="${Formatter.an(o.nhan)}">
                    <input type="radio" name="${id}" value="${Formatter.an(o.giaTri)}" class="sr-only peer"
                           ${String(o.giaTri) === String(t.giaTri ?? '') ? 'checked' : ''}>
                    <span class="block h-16 rounded-lg overflow-hidden border-2 border-slate-600/40
                                 peer-checked:border-amber-400 peer-checked:ring-2 peer-checked:ring-amber-400/40">
                        ${o.anh
                            ? `<img src="${Formatter.an(o.anh)}" alt="${Formatter.an(o.nhan)}" class="w-full h-full object-cover">`
                            : `<span class="flex items-center justify-center h-full px-1 text-xs text-slate-400 text-center">${Formatter.an(o.nhan)}</span>`}
                    </span>
                </label>`).join('');
            return `${nhan}<div id="${id}" class="grid grid-cols-4 gap-2 text-left">${o}</div>`;
        }
        return `${nhan}<input id="${id}" type="${t.kieu || 'text'}"
                       value="${Formatter.an(t.giaTri ?? '')}" class="${lop}">`;
    }

    /** Đọc và kiểm tra biểu mẫu. Trả về null để SweetAlert2 không đóng. */
    _docForm(truong) {
        const kq = {};
        for (const t of truong) {
            const o = document.getElementById('truong_' + t.ten);
            if (!o) continue;

            if (t.kieu === 'file') {
                kq[t.ten] = o.files && o.files[0] ? o.files[0] : null;
            } else if (t.kieu === 'chonAnh') {
                const chon = o.querySelector('input:checked');
                kq[t.ten] = chon ? chon.value : '';
            } else {
                kq[t.ten] = o.value.trim();
            }

            if (t.batBuoc && !kq[t.ten]) {
                Swal.showValidationMessage(`Vui lòng nhập ${t.nhan}`);
                return null;
            }
            if (t.kiemTra) {
                const loi = t.kiemTra(kq[t.ten]);
                if (loi) { Swal.showValidationMessage(loi); return null; }
            }
        }
        return kq;
    }

    /**
     * Gắn sự kiện MỘT LẦN bằng uỷ quyền (event delegation).
     *
     * Cách cũ gắn lại .click() cho từng nút sau MỖI lần vẽ bảng. Làm vậy
     * vừa tốn công vừa dễ tích tụ listener trùng nếu quên hủy. Uỷ quyền
     * trên phần tử cha ổn định thì chỉ cần gắn một lần, và tự động áp dụng
     * cho cả những dòng được vẽ sau này.
     */
    _ganSuKien() {
        // So theo PHẦN TỬ chứ không theo cờ đã-gắn: màn hình nằm trong một
        // tab con (NguyenLieuScreen trong KhoScreen) có khung bảng bị vẽ lại
        // mỗi lần chuyển tab. Theo cờ thì khung mới không có listener, và
        // các nút Sửa/Ngừng im lặng không làm gì. Màn hình có khung cố định
        // thì phần tử không đổi, nên vẫn chỉ gắn đúng một lần như trước.
        const khung = document.querySelector(this.selectorBang);
        if (!khung || khung === this._khungDaGan) return;

        khung.addEventListener('click', (e) => {
            const nutSua = e.target.closest('.nut-sua');
            if (nutSua) { this.moFormSua(nutSua.dataset.id); return; }

            const nutXoa = e.target.closest('.nut-xoa');
            if (nutXoa) { this.xacNhanXoa(nutXoa.dataset.id); return; }

            // Điểm mở rộng: lớp con xử lý các thao tác riêng của mình,
            // ví dụ bấm chọn một danh mục để lọc danh sách món.
            this.ganSuKienRieng(e, khung);
        });

        this._khungDaGan = khung;
    }

    /**
     * Xử lý thao tác riêng của từng màn hình, chạy sau khi đã loại trừ
     * nút sửa và nút xóa. Mặc định không làm gì.
     */
    ganSuKienRieng(suKien, khung) { /* lớp con ghi đè nếu cần */ }

    _dangKySocket() {
        this.suKienCanNghe().forEach(ten => {
            this._huyDangKySocket.push(
                SocketBus.nghe(ten, () => this.nap())
            );
        });
    }

    /**
     * Tìm tên trường khóa chính trong bản ghi.
     * Máy chủ trả về tên viết HOA (MALOAI) trong khi tham số gửi lên viết
     * thường (maloai), nên phải dò cả hai kiểu.
     */
    _tenTruongKhoa(banGhi) {
        const hoa = this.khoaChinh.toUpperCase();
        if (banGhi && hoa in banGhi) return hoa;
        return this.khoaChinh;
    }

    _timBanGhi(id) {
        return this.duLieu.find(bg => String(bg[this._tenTruongKhoa(bg)]) === String(id));
    }
}
