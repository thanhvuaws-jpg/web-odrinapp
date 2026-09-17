import { CrudScreen } from './CrudScreen.js';
import { ApiClient }  from '../core/ApiClient.js';
import { Dialog }     from '../core/Dialog.js';
import { Formatter }  from '../core/Formatter.js';
import { SocketBus }  from '../core/SocketBus.js';

/**
 * BookingScreen — màn hình quản lý phiếu đặt bàn (bảng DATBAN).
 *
 * KHÁC BIỆT SO VỚI BA MÀN HÌNH KIA — VÀ NÓI THẲNG PHẦN KHÔNG KHỚP
 * ---------------------------------------------------------------
 * Đây không phải CRUD thuần. Người quản lý không "tạo" phiếu đặt bàn từ
 * trang quản trị — phiếu do khách tạo từ landing page hoặc từ ứng dụng.
 * Việc của quản lý là ĐỔI TRẠNG THÁI phiếu theo vòng đời của nó.
 *
 * Vì vậy màn hình này dùng phần lớn lớp cơ sở (nạp, vẽ, uỷ quyền sự kiện,
 * phát socket, tra cứu bản ghi) nhưng KHÔNG dùng bộ máy biểu mẫu
 * (`truongForm`, `moFormThem`, `moFormSua`). Ghi rõ ở đây để người đọc sau
 * không mất công tìm biểu mẫu không tồn tại.
 *
 * Thao tác "xóa" của lớp cơ sở được dùng lại cho việc HỦY phiếu — về mặt
 * nghiệp vụ thì hủy đúng hơn xóa, vì phiếu đã hủy vẫn cần lưu để đối chiếu.
 *
 * VÒNG ĐỜI PHIẾU ĐẶT BÀN
 * ----------------------
 *   pending ──xác nhận──> confirmed ──khách tới──> checked_in ──> completed
 *      │                      │
 *      └──────── hủy ─────────┴──> cancelled
 *
 * ĐỒNG BỘ THỜI GIAN THỰC
 * ----------------------
 * `ManageBookingsFragment` trên Android đã lắng nghe sẵn sự kiện
 * `booking_status_updated`, nên chỉ cần khai báo đúng ở `suKienSauKhiGhi()`.
 * Không phải sửa ứng dụng.
 */
export class BookingScreen extends CrudScreen {

    /** Nhãn và màu cho từng trạng thái — gom một chỗ thay vì rải trong HTML. */
    static TRANG_THAI = {
        pending:    { nhan: 'Chờ xác nhận', mau: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
        confirmed:  { nhan: 'Đã xác nhận',  mau: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
        checked_in: { nhan: 'Đã nhận bàn',  mau: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        completed:  { nhan: 'Hoàn tất',     mau: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
        cancelled:  { nhan: 'Đã hủy',       mau: 'bg-red-500/15 text-red-400 border-red-500/30' }
    };

    constructor() {
        super();
        this.boLoc = 'tatca';   // 'tatca' | 'pending' | 'confirmed' | 'checked_in' | 'cancelled'
    }

    get tenHienThi()       { return 'phiếu đặt bàn'; }
    get endpointDanhSach() { return 'get_bookings.php'; }
    get endpointGhi()      { return 'update_booking_status.php'; }
    get khoaChinh()        { return 'madatban'; }
    get selectorBang()     { return '#bookingTableBody'; }

    suKienSauKhiGhi() { return ['booking_status_updated', 'refresh_orders']; }
    suKienCanNghe()   { return ['booking_status_updated']; }

    cotBang() { return []; }

    /** Không dùng biểu mẫu — xem chú thích đầu tệp. */
    truongForm() { return []; }

    doiBoLoc(boLoc) {
        this.boLoc = boLoc;
        this.ve();
    }

    _locTheoTab() {
        if (this.boLoc === 'tatca') return this.duLieu;
        return this.duLieu.filter(p => p.TINHTRANG === this.boLoc);
    }

    ve() {
        const khung = document.querySelector(this.selectorBang);
        if (!khung) return;
        const ds = this._locTheoTab();
        khung.innerHTML = ds.length ? this.veNoiDung(ds) : this.htmlRong();
    }

    htmlRong() {
        return `<tr><td colspan="6" class="py-8 text-center text-slate-400">
                    Không có phiếu đặt bàn nào ở trạng thái này.
                </td></tr>`;
    }

    veNoiDung(danhSach) {
        return danhSach.map(p => {
            const id = Formatter.an(p.MADATBAN);
            const tt = BookingScreen.TRANG_THAI[p.TINHTRANG]
                    || { nhan: Formatter.an(p.TINHTRANG), mau: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };

            // Nguồn đặt: khách vãng lai từ landing page, hay khách có tài khoản
            const nguon = p.LA_VANG_LAI
                ? '<span class="text-[10px] text-slate-500 block">Khách vãng lai</span>'
                : '<span class="text-[10px] text-gold-400/70 block">Có tài khoản</span>';

            return `
                <tr class="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td class="px-4 py-3">
                        <div class="font-bold text-slate-800 dark:text-white text-sm">${Formatter.an(p.TENNGUOIDAT)}</div>
                        ${nguon}
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        <i class="fa-solid fa-phone mr-1"></i>${Formatter.an(p.SDTNGUOIDAT) || '—'}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        ${Formatter.an(p.TENBAN)}
                        ${Number(p.SOKHACH) > 0
                            ? `<span class="text-xs text-slate-500 block">${Formatter.an(p.SOKHACH)} khách</span>` : ''}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ${Formatter.gioPhut(p.THOIGIANHEN)}
                        <span class="text-xs text-slate-500 block">${Formatter.ngay(p.THOIGIANHEN)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border ${tt.mau}">${tt.nhan}</span>
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        ${this._veNutThaoTac(p, id)}
                    </td>
                </tr>`;
        }).join('');
    }

    /**
     * Chỉ hiện những nút HỢP LỆ với trạng thái hiện tại.
     *
     * Hiện nút "Nhận bàn" cho một phiếu chưa xác nhận sẽ khiến người dùng
     * bấm rồi nhận lỗi — thà không hiện còn hơn.
     */
    _veNutThaoTac(phieu, id) {
        const nut = [];
        const lop = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ml-1';

        if (phieu.TINHTRANG === 'pending') {
            nut.push(`<button class="nut-xac-nhan ${lop} border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                              data-id="${id}"><i class="fa-solid fa-check mr-1"></i>Xác nhận</button>`);
        }
        if (phieu.TINHTRANG === 'confirmed') {
            nut.push(`<button class="nut-nhan-ban ${lop} border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              data-id="${id}"><i class="fa-solid fa-door-open mr-1"></i>Nhận bàn</button>`);
        }
        if (['pending', 'confirmed'].includes(phieu.TINHTRANG)) {
            nut.push(`<button class="nut-xoa ${lop} border-red-500/40 text-red-400 hover:bg-red-500/10"
                              data-id="${id}"><i class="fa-solid fa-xmark mr-1"></i>Hủy</button>`);
        }
        if (nut.length === 0) {
            return '<span class="text-xs text-slate-500">Không còn thao tác</span>';
        }
        return nut.join('');
    }

    async ganSuKienRieng(suKien) {
        const nutXacNhan = suKien.target.closest('.nut-xac-nhan');
        if (nutXacNhan) { await this._doiTrangThai(nutXacNhan.dataset.id, 'confirm_booking.php', 'Đã xác nhận phiếu'); return; }

        const nutNhanBan = suKien.target.closest('.nut-nhan-ban');
        if (nutNhanBan) { await this._doiTrangThai(nutNhanBan.dataset.id, 'checkin_booking.php', 'Khách đã nhận bàn'); return; }
    }

    async _doiTrangThai(madatban, tep, thongBao) {
        let manv = null;
        try { manv = localStorage.getItem('manv'); } catch (e) { /* bỏ qua */ }

        try {
            // Cả hai endpoint đều cần manv để ghi nhận ai là người thao tác
            await ApiClient.ghi(tep, { madatban, manv: manv || 0 });
            Dialog.thanhCong(thongBao);
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /**
     * Dùng lại luồng "xóa" của lớp cơ sở cho việc HỦY phiếu.
     *
     * Ghi đè để gửi đúng tham số: endpoint update_booking_status.php nhận
     * `tinhtrang` chứ không nhận `action` như ba endpoint kia.
     */
    async xacNhanXoa(id) {
        const phieu = this._timBanGhi(id);
        if (!phieu) return;

        const dongY = await Dialog.xacNhanXoa(
            'Hủy phiếu đặt bàn này?',
            `Phiếu của ${phieu.TENNGUOIDAT} lúc ${Formatter.gioPhut(phieu.THOIGIANHEN)} `
            + `ngày ${Formatter.ngay(phieu.THOIGIANHEN)} sẽ chuyển sang trạng thái đã hủy. `
            + `Bàn sẽ được giải phóng cho khung giờ đó.`
        );
        if (!dongY) return;

        try {
            await ApiClient.ghi(this.endpointGhi, {
                madatban: id,
                tinhtrang: 'cancelled'
            });
            Dialog.thanhCong('Đã hủy phiếu');
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }
}
