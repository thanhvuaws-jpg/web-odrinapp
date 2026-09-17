import { CrudScreen } from './CrudScreen.js';
import { ApiClient }  from '../core/ApiClient.js';
import { Dialog }     from '../core/Dialog.js';
import { Formatter }  from '../core/Formatter.js';
import { SocketBus }  from '../core/SocketBus.js';

/**
 * DishScreen — màn hình quản lý món ăn (bảng MON).
 *
 * Khác danh mục ở ba điểm, và cả ba đều xử lý bằng cách ghi đè điểm mở
 * rộng của lớp cơ sở chứ không phải viết lại luồng:
 *
 *   1. Danh sách được LỌC theo danh mục đang chọn (thamSoDanhSach)
 *   2. Mỗi dòng có CÔNG TẮC bật/tắt trạng thái còn bán (ganSuKienRieng)
 *   3. Biểu mẫu có thêm ô chọn danh mục và ô giá tiền (truongForm)
 */
export class DishScreen extends CrudScreen {

    constructor() {
        super();
        this.maLoaiDangLoc = null;
        this.danhSachLoai = [];   // dùng để đổ vào ô chọn danh mục của biểu mẫu
    }

    get tenHienThi()       { return 'món ăn'; }
    get endpointDanhSach() { return 'get_dishes.php'; }
    get endpointGhi()      { return 'update_dish.php'; }
    get khoaChinh()        { return 'mamon'; }
    get selectorBang()     { return '#dishesTableBody'; }

    suKienSauKhiGhi() { return ['refresh_orders', 'menu_changed']; }

    /** Chỉ lấy món thuộc danh mục đang chọn; limit 100 là đủ cho một danh mục. */
    thamSoDanhSach() {
        return { maloai: this.maLoaiDangLoc || 0, page: 1, limit: 100 };
    }

    /** Đổi danh mục đang xem rồi nạp lại. */
    async locTheoDanhMuc(danhMuc) {
        this.maLoaiDangLoc = danhMuc ? danhMuc.MALOAI : null;
        const tieuDe = document.getElementById('dishSectionTitle');
        if (tieuDe && danhMuc) tieuDe.textContent = `Món Ăn - ${danhMuc.TENLOAI}`;
        await this.nap();
    }

    /** Danh sách danh mục để đổ vào ô chọn của biểu mẫu. */
    capNhatDanhSachLoai(ds) { this.danhSachLoai = ds || []; }

    cotBang() { return []; }   // không dùng — màn hình này tự vẽ dòng bảng

    htmlRong() {
        return `<tr><td colspan="4" class="py-6 text-center text-slate-400 dark:text-slate-500">
                    Danh mục này chưa có món ăn nào
                </td></tr>`;
    }

    /**
     * Vẽ các dòng <tr>. Phần tử chứa là một <tbody> có sẵn trong
     * admin.html, nên chỉ trả về dòng chứ không dựng lại cả bảng.
     */
    veNoiDung(duLieu) {
        return duLieu.map(m => {
            const anh = m.HINHANH ? Formatter.an(m.HINHANH) : 'https://placehold.co/100x100?text=Food';
            const daBat = String(m.TINHTRANG) === 'true' ? 'checked' : '';
            const id = Formatter.an(m.MAMON);

            return `
                <tr class="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td class="py-3 flex items-center space-x-3">
                        <img class="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800"
                             src="${anh}" alt="${Formatter.an(m.TENMON)}" loading="lazy"
                             onerror="this.src='https://placehold.co/100x100?text=Food'">
                        <div>
                            <span class="font-semibold text-slate-800 dark:text-slate-200 block text-sm">${Formatter.an(m.TENMON)}</span>
                            <span class="text-xs text-slate-400 dark:text-slate-500">Mã món: #${id}</span>
                        </div>
                    </td>
                    <td class="py-3 text-right font-extrabold text-slate-800 dark:text-white text-sm">
                        ${Formatter.tien(m.GIATIEN)}đ
                    </td>
                    <td class="py-3 text-center">
                        <label class="relative inline-flex items-center cursor-pointer justify-center">
                            <input type="checkbox" data-id="${id}" class="cong-tac-trang-thai sr-only peer" ${daBat}>
                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-600"></div>
                        </label>
                    </td>
                    <td class="py-3 text-right">
                        <div class="flex items-center justify-end space-x-2">
                            <button class="nut-sua p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-gold hover:text-gold text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm"
                                    data-id="${id}" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                            <button class="nut-xoa p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 hover:text-red-500 text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm"
                                    data-id="${id}" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    /**
     * Bật/tắt trạng thái còn bán.
     *
     * Dùng endpoint riêng update_dish_status.php thay vì update_dish.php,
     * vì đây là thao tác một chạm: gửi qua endpoint đầy đủ sẽ phải kèm cả
     * tên món, giá, ảnh — thừa và dễ ghi đè nhầm dữ liệu.
     */
    async ganSuKienRieng(suKien) {
        const congTac = suKien.target.closest('.cong-tac-trang-thai');
        if (!congTac) return;

        const id = congTac.dataset.id;
        const trangThaiMoi = congTac.checked ? 'true' : 'false';

        try {
            await ApiClient.ghi('update_dish_status.php', {
                mamon: id, tinhtrang: trangThaiMoi
            });
            SocketBus.phatNhieu(this.suKienSauKhiGhi());

            // Cập nhật bản sao trong bộ nhớ để lần vẽ sau không bị lệch
            const banGhi = this._timBanGhi(id);
            if (banGhi) banGhi.TINHTRANG = trangThaiMoi;
        } catch (e) {
            // Trả công tắc về trạng thái cũ: nếu để nguyên, giao diện sẽ
            // hiển thị một giá trị mà máy chủ chưa hề chấp nhận.
            congTac.checked = !congTac.checked;
            Dialog.loiApi(e);
        }
    }

    truongForm(banGhi) {
        return [
            {
                ten: 'tenmon', nhan: 'Tên món ăn', kieu: 'text', batBuoc: true,
                giaTri: banGhi ? banGhi.TENMON : ''
            },
            {
                ten: 'giatien', nhan: 'Giá tiền (VNĐ)', kieu: 'number', batBuoc: true,
                giaTri: banGhi ? banGhi.GIATIEN : '',
                kiemTra: (v) => {
                    const so = parseInt(v, 10);
                    if (!Number.isFinite(so) || so <= 0) return 'Giá tiền phải là số lớn hơn 0';
                    if (so > 999999999) return 'Giá tiền vượt quá giới hạn cho phép';
                    return null;
                }
            },
            {
                ten: 'maloai', nhan: 'Danh mục', kieu: 'select',
                giaTri: banGhi ? banGhi.MALOAI : this.maLoaiDangLoc,
                tuyChon: this.danhSachLoai.map(l => ({ giaTri: l.MALOAI, nhan: l.TENLOAI }))
            },
            {
                ten: 'hinhanh',
                nhan: banGhi ? 'Ảnh mới (bỏ trống nếu giữ ảnh cũ)' : 'Ảnh món ăn',
                kieu: 'file'
            }
        ];
    }

    canhBaoXoa() {
        return 'Món ăn này sẽ bị xóa khỏi thực đơn. '
             + 'Nếu món đã từng xuất hiện trong đơn hàng, cơ sở dữ liệu sẽ từ chối để bảo toàn lịch sử.';
    }

    async chuanBiDuLieuGui(duLieuForm) {
        const goiTin = { ...duLieuForm };
        if (goiTin.hinhanh instanceof File) {
            goiTin.hinhanh = await DishScreen._docTepThanhBase64(goiTin.hinhanh);
        } else {
            delete goiTin.hinhanh;
        }
        // Món thêm mới mặc định là còn bán
        if (goiTin.action === 'add') goiTin.tinhtrang = 'true';
        return goiTin;
    }

    static _docTepThanhBase64(tep) {
        return new Promise((ok, loi) => {
            const doc = new FileReader();
            doc.onload  = () => ok(doc.result);
            doc.onerror = () => loi(new Error('Không đọc được tệp ảnh'));
            doc.readAsDataURL(tep);
        });
    }
}
