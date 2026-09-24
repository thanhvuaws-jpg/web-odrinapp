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
 *
 * ẢNH BÀN (QĐ-095, 25/09/2026)
 * ----------------------------
 * Thẻ bàn hiện ảnh thật (khách cũng thấy ảnh này khi chọn bàn để đặt).
 * Form thêm/sửa cho chọn một ảnh mẫu có sẵn trên máy chủ (ban_anh_mau.php)
 * hoặc tải ảnh từ máy tính lên. Máy chủ chỉ nhận ảnh mẫu đúng danh sách của
 * nó, nên không gõ tay được đường dẫn lạ.
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

    /** Ảnh mẫu của bàn, nạp một lần cùng danh sách để form mở ra là có ngay. */
    _anhMau = [];

    async nap() {
        if (!this._anhMau.length) {
            try {
                const kq = await ApiClient.goi('ban_anh_mau.php');
                this._anhMau = (kq && kq.ANH) || [];
            } catch (e) {
                // Không có ảnh mẫu vẫn thêm/sửa bàn được (tải ảnh lên, hoặc không ảnh).
                this._anhMau = [];
            }
        }
        await super.nap();
    }

    /** URL hiển thị của ảnh: ảnh nội bộ phải ghép tiền tố /api/, ảnh ngoài dùng thẳng. */
    static _urlAnh(loai, duongDan) {
        if (!duongDan) return null;
        return loai === 'anh_noi_bo' ? ApiClient.TIEN_TO + duongDan : duongDan;
    }

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
            const soPhieu   = Number(b.SO_PHIEU) || 0;
            const anh       = TableScreen._urlAnh(b.LOAI_ANH, b.URL_ANH_NHO || b.URL_ANH);

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

            // Bàn đã có đơn hay phiếu đặt thì máy chủ không cho xóa (giữ lịch
            // sử), nên không hiện nút xóa — thay bằng chú thích để người dùng
            // hiểu vì sao, thay vì bấm rồi nhận lỗi.
            const lichSu = [soDon > 0 ? `${soDon} đơn` : '', soPhieu > 0 ? `${soPhieu} phiếu đặt` : '']
                .filter(Boolean).join(', ');
            const nutXoa = lichSu
                ? `<span class="p-1.5 text-slate-600" title="Đã có ${lichSu} nên không thể xóa — dùng chế độ bảo trì">
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
                                    data-id="${id}" title="Sửa tên và ảnh bàn">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                            ${nutXoa}
                        </div>
                    </div>
                    <div class="text-center py-2">
                        ${anh
                            ? `<img src="${Formatter.an(anh)}" alt="" loading="lazy"
                                    class="w-full h-24 object-cover rounded-xl mb-2 ${hoatDong ? '' : 'opacity-50 grayscale'}">`
                            : `<i class="fa-solid fa-chair text-3xl ${mauIcon} mb-2"></i>`}
                        <div class="font-serif font-bold ${mauChu} text-base truncate">
                            ${Formatter.an(b.TENBAN)}
                        </div>
                        <div class="text-xs text-slate-500 mt-0.5">
                            Mã bàn #${id}${lichSu ? ` · ${lichSu}` : ''}
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
        // Ô đầu: giữ nguyên (sửa) hoặc không ảnh (thêm). Sửa bàn đang có ảnh
        // thì thêm ô "Bỏ ảnh". Còn lại là các ảnh mẫu.
        const dauTien = banGhi
            ? { giaTri: '', nhan: 'Giữ ảnh hiện tại',
                anh: TableScreen._urlAnh(banGhi.LOAI_ANH, banGhi.URL_ANH_NHO || banGhi.URL_ANH) }
            : { giaTri: '', nhan: 'Không ảnh' };
        const tuyChon = [dauTien];
        if (banGhi && banGhi.URL_ANH) tuyChon.push({ giaTri: '__bo__', nhan: 'Bỏ ảnh' });
        for (const a of this._anhMau) {
            tuyChon.push({ giaTri: a.DUONG_DAN, nhan: a.TEN,
                           anh: TableScreen._urlAnh(a.LOAI_ANH, a.URL_ANH_NHO || a.URL_ANH) });
        }

        return [
            {
                ten: 'tenban',
                nhan: 'Tên bàn',
                kieu: 'text',
                batBuoc: true,
                giaTri: banGhi ? banGhi.TENBAN : '',
                kiemTra: (v) => v.length > 50 ? 'Tên bàn tối đa 50 ký tự' : null
            },
            {
                ten: 'anh_mau',
                nhan: 'Ảnh bàn — chọn ảnh mẫu',
                kieu: 'chonAnh',
                giaTri: '',
                tuyChon
            },
            {
                ten: 'anh_tai_len',
                nhan: 'Hoặc tải ảnh từ máy (ưu tiên hơn ảnh mẫu)',
                kieu: 'file'
            }
        ];
    }

    /**
     * Đổi hai trường ảnh của form thành đúng MỘT trường máy chủ hiểu:
     * hinhanh_base64 (tải lên) > hinhanh (ảnh mẫu) > xoa_anh > không gửi gì
     * (giữ nguyên ảnh cũ).
     */
    async chuanBiDuLieuGui(duLieuForm) {
        const { anh_mau, anh_tai_len, ...goiTin } = duLieuForm;
        if (anh_tai_len instanceof File) {
            if (anh_tai_len.size > 5 * 1024 * 1024) {
                throw new Error('Ảnh quá lớn (tối đa 5 MB).');
            }
            goiTin.hinhanh_base64 = await TableScreen._docTepThanhBase64(anh_tai_len);
        } else if (anh_mau === '__bo__') {
            goiTin.xoa_anh = '1';
        } else if (anh_mau) {
            goiTin.hinhanh = anh_mau;
        }
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
        const soPhieu = Number(banGhi.SO_PHIEU) || 0;
        if (soDon > 0 || soPhieu > 0) {
            const lichSu = [soDon > 0 ? `${soDon} đơn hàng` : '', soPhieu > 0 ? `${soPhieu} phiếu đặt bàn` : '']
                .filter(Boolean).join(' và ');
            return `Bàn này đã có ${lichSu} nên không thể xóa — hệ thống giữ lại để bảo toàn lịch sử. `
                 + `Nếu bàn không còn dùng, hãy chuyển sang chế độ BẢO TRÌ (biểu tượng cờ-lê) — bàn sẽ bị loại khỏi danh sách đặt bàn nhưng vẫn giữ nguyên lịch sử.`;
        }
        return null;
    }

    /**
     * Chỉ còn bàn chưa từng dùng mới tới được hộp thoại này (kiemTraTruocKhiXoa
     * chặn bàn có đơn hay phiếu đặt, và máy chủ cũng chặn — QĐ-095). Trước đây
     * bàn có phiếu đặt vẫn xóa được, và CASCADE xóa luôn phiếu của khách.
     */
    canhBaoXoa(banGhi) {
        return 'Bàn chưa từng có đơn hay phiếu đặt nào, sẽ bị xóa khỏi sơ đồ.';
    }
}
