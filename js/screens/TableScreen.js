import { CrudScreen } from './CrudScreen.js';
import { ApiClient }  from '../core/ApiClient.js';
import { Dialog }     from '../core/Dialog.js';
import { Formatter }  from '../core/Formatter.js';
import { SocketBus }  from '../core/SocketBus.js';

/**
 * TableScreen — màn hình quản lý bàn ăn (bảng BAN).
 *
 * VÌ SAO CÓ MÀN HÌNH NÀY
 * ----------------------
 * Trước đây web quản trị hoàn toàn không có phần bàn ăn. Muốn thêm bàn,
 * đổi tên hay xóa bàn thì bắt buộc phải mở ứng dụng trên điện thoại —
 * dù người quản lý đang ngồi trước máy tính. Toàn bộ endpoint đã sẵn có
 * từ lâu (`get_tables.php`, `update_table_admin.php`), chỉ thiếu giao diện.
 *
 * PHÂN BIỆT HAI VAI TRÒ CỦA "MÀN HÌNH BÀN"
 * ----------------------------------------
 * Trên ứng dụng Android, màn hình bàn gộp chung hai việc: nhân viên bấm
 * vào bàn để gọi món (vận hành), và quản lý thêm/xóa bàn (quản trị).
 *
 * Bản web này cố ý CHỈ làm phần quản trị. Việc gọi món diễn ra khi nhân
 * viên đang đứng cạnh bàn, làm trên điện thoại hợp lý hơn ngồi máy tính.
 *
 * ĐỒNG BỘ THỜI GIAN THỰC
 * ----------------------
 * Ứng dụng Android (`DisplayTableFragment`) đã lắng nghe sẵn sự kiện
 * `refresh_orders` và khi nhận thì gọi `HienThiDSBan()` — nạp lại toàn bộ
 * sơ đồ bàn. Vì nạp lại cả danh sách chứ không vá từng dòng, nó bắt được
 * cả bàn mới thêm, bàn đổi tên và bàn bị xóa.
 *
 * Nên chỉ cần khai báo đúng sự kiện ở `suKienSauKhiGhi()` là xong — không
 * phải sửa hay build lại ứng dụng Android.
 */
export class TableScreen extends CrudScreen {

    get tenHienThi()       { return 'bàn ăn'; }
    get endpointDanhSach() { return 'get_tables.php'; }
    get endpointGhi()      { return 'update_table_admin.php'; }
    get khoaChinh()        { return 'maban'; }
    get selectorBang()     { return '#tableGrid'; }

    /** Xem chú thích đầu tệp: đây là sự kiện DisplayTableFragment đang nghe. */
    suKienSauKhiGhi() { return ['refresh_orders']; }

    /** Bàn đổi trạng thái khi có người gọi món ở thiết bị khác. */
    suKienCanNghe() { return ['refresh_orders']; }

    cotBang() { return []; }   // màn hình này vẽ dạng lưới thẻ, không phải bảng

    htmlRong() {
        return `<div class="col-span-full py-10 text-center text-slate-400">
                    Chưa có bàn ăn nào. Bấm nút + để thêm bàn đầu tiên.
                </div>`;
    }

    /**
     * Vẽ dạng lưới thẻ, mô phỏng sơ đồ bàn cho dễ nhìn — hợp với việc
     * quản lý một không gian vật lý hơn là một bảng dữ liệu.
     */
    veNoiDung(duLieu) {
        return duLieu.map(b => {
            const id        = Formatter.an(b.MABAN);
            const dangDung  = String(b.TINHTRANG) === 'true';
            // Mặc định 'true' để bàn cũ (chưa có cột này) vẫn coi là đang hoạt động
            const hoatDong  = String(b.HOATDONG ?? 'true') === 'true';
            const soDon     = Number(b.SO_DON) || 0;

            // Ba trạng thái hiển thị, xét theo thứ tự ưu tiên:
            // bảo trì > đang có khách > trống
            let mauVien, nhan, mauIcon, mauChu;
            if (!hoatDong) {
                mauVien = 'border-slate-600/40 bg-slate-700/10';
                nhan    = '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-600/20 text-slate-400 border border-slate-500/30"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>Bảo trì</span>';
                mauIcon = 'text-slate-500/50';
                mauChu  = 'text-slate-500';
            } else if (dangDung) {
                mauVien = 'border-red-500/40 bg-red-500/5';
                nhan    = '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">Đang dùng</span>';
                mauIcon = 'text-red-400/70';
                mauChu  = 'text-white light:text-royal-900';
            } else {
                mauVien = 'border-emerald-500/30 bg-emerald-500/5';
                nhan    = '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Trống</span>';
                mauIcon = 'text-emerald-400/70';
                mauChu  = 'text-white light:text-royal-900';
            }

            // Bàn đã có lịch sử đơn thì không xóa được (khóa ngoại NO ACTION),
            // nên không hiện nút xóa — thay bằng chú thích để người dùng hiểu
            // vì sao, thay vì bấm rồi nhận lỗi.
            const nutXoa = soDon > 0
                ? `<span class="p-1.5 text-slate-600" title="Đã có ${soDon} đơn trong lịch sử nên không thể xóa">
                       <i class="fa-solid fa-lock text-xs"></i>
                   </span>`
                : `<button class="nut-xoa p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                           data-id="${id}" title="Xóa bàn">
                       <i class="fa-solid fa-trash text-xs"></i>
                   </button>`;

            return `
                <div class="relative rounded-2xl border ${mauVien} p-4 transition-all hover:border-gold-400/50">
                    <div class="flex items-start justify-between mb-3">
                        ${nhan}
                        <div class="flex items-center space-x-1">
                            <button class="nut-bao-tri p-1.5 rounded-lg transition-colors ${hoatDong ? 'text-slate-400 hover:text-amber-400' : 'text-amber-400 hover:text-emerald-400'}"
                                    data-id="${id}" data-hoatdong="${hoatDong ? 'true' : 'false'}"
                                    title="${hoatDong ? 'Chuyển sang chế độ bảo trì' : 'Cho bàn hoạt động trở lại'}">
                                <i class="fa-solid ${hoatDong ? 'fa-screwdriver-wrench' : 'fa-rotate-left'} text-xs"></i>
                            </button>
                            <button class="nut-sua p-1.5 rounded-lg text-slate-400 hover:text-gold-400 transition-colors"
                                    data-id="${id}" title="Đổi tên bàn">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                            ${nutXoa}
                        </div>
                    </div>
                    <div class="text-center py-2">
                        <i class="fa-solid fa-chair text-3xl ${mauIcon} mb-2"></i>
                        <div class="font-serif font-bold ${mauChu} text-base truncate">
                            ${Formatter.an(b.TENBAN)}
                        </div>
                        <div class="text-xs text-slate-500 mt-0.5">
                            Mã bàn #${id}${soDon > 0 ? ` · ${soDon} đơn` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    /**
     * Bật/tắt chế độ bảo trì.
     *
     * Đây là lối thoát cho ràng buộc không xóa được bàn: bàn hỏng hay tạm
     * ngưng vẫn giữ nguyên trong cơ sở dữ liệu để bảo toàn lịch sử doanh
     * thu, nhưng bị loại khỏi danh sách xếp bàn khi khách đặt.
     */
    async ganSuKienRieng(suKien) {
        const nut = suKien.target.closest('.nut-bao-tri');
        if (!nut) return;

        const id = nut.dataset.id;
        const dangHoatDong = nut.dataset.hoatdong === 'true';
        const banGhi = this._timBanGhi(id);
        const tenBan = banGhi ? banGhi.TENBAN : `#${id}`;

        // Dùng xacNhan() chứ không phải xacNhanXoa(): đây là thao tác có thể
        // hoàn tác, nhãn nút phải phản ánh đúng điều đó.
        const dongY = await Dialog.xacNhan(
            dangHoatDong ? `Chuyển "${tenBan}" sang bảo trì?` : `Cho "${tenBan}" hoạt động lại?`,
            dangHoatDong
                ? 'Bàn sẽ không xuất hiện khi khách đặt bàn trực tuyến, nhưng vẫn giữ nguyên lịch sử đơn hàng. Có thể bật lại bất cứ lúc nào.'
                : 'Bàn sẽ nhận đặt bàn trở lại như bình thường.',
            dangHoatDong ? 'Chuyển bảo trì' : 'Bật hoạt động'
        );
        if (!dongY) return;

        try {
            await ApiClient.ghi(this.endpointGhi, {
                action: 'toggle',
                maban: id,
                hoatdong: dangHoatDong ? 'false' : 'true'
            });
            Dialog.thanhCong(dangHoatDong ? 'Đã chuyển sang bảo trì' : 'Bàn đã hoạt động trở lại');
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    truongForm(banGhi) {
        return [
            {
                ten: 'tenban',
                nhan: 'Tên bàn',
                kieu: 'text',
                batBuoc: true,
                giaTri: banGhi ? banGhi.TENBAN : '',
                kiemTra: (v) => v.length > 255 ? 'Tên bàn quá dài (tối đa 255 ký tự)' : null
            }
        ];
    }

    /**
     * Chặn xóa từ trước, thay vì để cơ sở dữ liệu từ chối rồi hiện lỗi chung.
     *
     * Hai ràng buộc khóa ngoại liên quan tới bảng BAN, và chúng hành xử
     * ngược nhau — đã kiểm chứng bằng truy vấn information_schema:
     *
     *   DONDAT.MABAN  -> BAN   NO ACTION  : có đơn thì KHÔNG xóa được
     *   DATBAN.MABAN  -> BAN   CASCADE    : xóa bàn là MẤT LUÔN phiếu đặt
     *
     * Trường hợp thứ nhất trước đây cho ra thông báo "Đã xảy ra lỗi, vui
     * lòng thử lại" — người dùng không thể đoán nổi nguyên nhân, vì lý do
     * thật chỉ nằm trong log máy chủ.
     *
     * Trường hợp thứ hai còn nguy hiểm hơn: nó KHÔNG báo lỗi gì cả, chỉ
     * lặng lẽ xóa toàn bộ phiếu đặt bàn kèm theo.
     */
    kiemTraTruocKhiXoa(banGhi) {
        if (String(banGhi.TINHTRANG) === 'true') {
            return 'Bàn này đang có khách. Vui lòng hoàn tất thanh toán trước khi xóa.';
        }

        const soDon = Number(banGhi.SO_DON) || 0;
        if (soDon > 0) {
            return `Bàn này đã có ${soDon} đơn hàng trong lịch sử nên không thể xóa. `
                 + `Cơ sở dữ liệu giữ lại để bảo toàn số liệu doanh thu. `
                 + `Nếu bàn không còn dùng, hãy chuyển sang chế độ BẢO TRÌ (biểu tượng cờ-lê) — bàn sẽ bị loại khỏi danh sách đặt bàn nhưng vẫn giữ nguyên lịch sử.`;
        }
        return null;
    }

    /**
     * Cảnh báo riêng khi bàn có phiếu đặt: những phiếu đó sẽ bị xóa theo
     * do quy tắc CASCADE, và người dùng cần biết trước điều đó.
     */
    canhBaoXoa(banGhi) {
        const soPhieu = banGhi ? (Number(banGhi.SO_PHIEU) || 0) : 0;
        if (soPhieu > 0) {
            return `CẢNH BÁO: bàn này có ${soPhieu} phiếu đặt bàn. `
                 + `Xóa bàn sẽ xóa theo TOÀN BỘ số phiếu đó và không khôi phục được.`;
        }
        return 'Bàn này sẽ bị xóa khỏi sơ đồ.';
    }
}
