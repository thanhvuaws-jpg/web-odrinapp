import { CrudScreen } from './CrudScreen.js';
import { Formatter } from '../core/Formatter.js';
import { Dialog } from '../core/Dialog.js';
import { ApiClient } from '../core/ApiClient.js';

/**
 * VoucherScreen — quản lý mẫu voucher (Quản lý > Voucher).
 *
 * Kế thừa CrudScreen nên phần khung — nạp, vẽ bảng, mở biểu mẫu, xác nhận
 * xóa, phát sự kiện socket — dùng lại nguyên vẹn. Lớp này chỉ khai báo
 * cột nào, trường nào, và ba chỗ cần cư xử khác:
 *
 *   1. Nút BẬT/TẮT nhanh trên từng dòng (ganSuKienRieng)
 *   2. Cảnh báo trước khi xóa, nêu rõ số mã đã phát (canhBaoXoa)
 *   3. Chặn hẳn việc xóa mẫu đã phát mã (kiemTraTruocKhiXoa)
 */
export class VoucherScreen extends CrudScreen {

    get tenHienThi()      { return 'voucher'; }
    get endpointDanhSach(){ return 'quan_ly_voucher.php'; }
    get endpointGhi()     { return 'quan_ly_voucher.php'; }
    get khoaChinh()       { return 'mavoucher'; }
    get selectorBang()    { return '#voucherTableContainer'; }

    /* ══════════════════════════ BẢNG ══════════════════════════ */

    cotBang() {
        return [
            {
                ten: 'TEN', nhan: 'Voucher',
                dinhDang: (v, bg) => `
                    <div class="font-semibold text-white">${Formatter.an(v)}</div>
                    <div class="text-xs text-slate-400">${Formatter.an(bg.MOTA || '')}</div>`
            },
            {
                ten: 'GIATRI', nhan: 'Mức giảm',
                dinhDang: (v, bg) => bg.LOAI_GIAM === 'phantram'
                    ? `<span class="text-gold-400 font-bold">${v}%</span>
                       <span class="text-xs text-slate-400 block">tối đa ${Formatter.tien(bg.GIAM_TOIDA)}</span>`
                    : `<span class="text-gold-400 font-bold">${Formatter.tien(v)}</span>`
            },
            {
                ten: 'DIEM_DOI', nhan: 'Đổi bằng',
                // DIEM_DOI = 0 nghĩa là mẫu này chỉ hệ thống phát, khách
                // không đổi bằng điểm được. Nói rõ thay vì hiện số 0.
                dinhDang: (v, bg) => bg.LA_QUA_TUAN === 'true'
                    ? `<span class="text-xs px-2 py-1 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Quà tuần</span>`
                    : (Number(v) > 0
                        ? `<span class="font-semibold">${v} điểm</span>`
                        : `<span class="text-xs text-slate-500">Không đổi được</span>`)
            },
            {
                ten: 'HANG_TOITHIEU', nhan: 'Hạng',
                dinhDang: (v) => {
                    const m = { dong: ['Đồng', '#CD7F32'], bac: ['Bạc', '#C0C0C0'], vang: ['Vàng', '#FFD700'] };
                    const [nhan, mau] = m[v] || [v, '#9E9E9E'];
                    return `<span class="text-xs font-bold" style="color:${mau}">${Formatter.an(nhan)}</span>`;
                }
            },
            {
                ten: 'NGAY_BATDAU', nhan: 'Chiến dịch',
                dinhDang: (v, bg) => {
                    if (!v && !bg.NGAY_KETTHUC) {
                        return `<span class="text-xs text-slate-500">Không giới hạn</span>`;
                    }
                    const tu  = v ? Formatter.ngay(v) : '—';
                    const den = bg.NGAY_KETTHUC ? Formatter.ngay(bg.NGAY_KETTHUC) : '—';
                    return `<span class="text-xs">${tu} → ${den}</span>`;
                }
            },
            {
                ten: 'SO_MA_PHAT', nhan: 'Đã phát',
                dinhDang: (v, bg) => `
                    <div class="text-sm"><b>${v}</b> mã</div>
                    <div class="text-xs text-slate-400">${bg.SO_MA_DUNG} đã dùng</div>`
            },
            {
                ten: 'HIEU_LUC', nhan: 'Trạng thái',
                dinhDang: (v, bg) => {
                    // Lớp Tailwind viết ĐẦY ĐỦ, không ghép chuỗi kiểu
                    // `bg-${mau}-500/15`. Trình quét của Tailwind tìm tên lớp
                    // theo văn bản; tên chỉ tồn tại sau khi JavaScript ghép
                    // xong thì nó không thấy, và lớp đó không bao giờ được
                    // sinh ra. Đây đúng là cái bẫy đã làm hỏng hoạt ảnh
                    // fadeInUp trước đây (QĐ-024).
                    const m = {
                        dang_chay:    ['Đang chạy',    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'],
                        chua_bat_dau: ['Chưa bắt đầu', 'bg-blue-500/15 text-blue-400 border-blue-500/30'],
                        da_ket_thuc:  ['Đã kết thúc',  'bg-slate-500/15 text-slate-400 border-slate-500/30'],
                        tat:          ['Đã tắt',       'bg-red-500/15 text-red-400 border-red-500/30'],
                    };
                    const [nhan, lopMau] = m[v] || [v, 'bg-slate-500/15 text-slate-400 border-slate-500/30'];
                    return `
                        <button class="nut-bat-tat text-xs px-2.5 py-1 rounded-lg border ${lopMau}
                                       hover:brightness-125 transition"
                                data-id="${bg.MAVOUCHER}" title="Bấm để bật/tắt">
                            ${Formatter.an(nhan)}
                        </button>`;
                }
            },
        ];
    }

    /* ══════════════════════════ BIỂU MẪU ══════════════════════════ */

    truongForm(bg) {
        const laPhanTram = bg ? bg.LOAI_GIAM === 'phantram' : false;

        return [
            { ten: 'ten', nhan: 'Tên voucher', giaTri: bg?.TEN, batBuoc: true },
            { ten: 'mota', nhan: 'Mô tả ngắn', kieu: 'textarea', giaTri: bg?.MOTA },
            {
                ten: 'loai_giam', nhan: 'Kiểu giảm', kieu: 'select',
                giaTri: bg?.LOAI_GIAM || 'tienmat',
                tuyChon: [
                    { giaTri: 'tienmat',  nhan: 'Giảm số tiền cố định' },
                    { giaTri: 'phantram', nhan: 'Giảm theo phần trăm' },
                ]
            },
            {
                ten: 'giatri', nhan: 'Giá trị (đồng hoặc %)', kieu: 'number',
                giaTri: bg?.GIATRI ?? '', batBuoc: true,
                kiemTra: (v) => Number(v) > 0 ? null : 'Giá trị giảm phải lớn hơn 0'
            },
            {
                ten: 'giam_toida', nhan: 'Giảm tối đa (chỉ cho kiểu %)', kieu: 'number',
                giaTri: bg?.GIAM_TOIDA ?? 0,
                // Không ép buộc ở đây được vì không biết người dùng vừa chọn
                // kiểu nào trong select — máy chủ kiểm tra lại và từ chối kèm
                // lý do rõ ràng. Đây chỉ là lớp nhắc trước cho trường hợp
                // đang SỬA một voucher vốn đã là kiểu phần trăm.
                kiemTra: (v) => (laPhanTram && Number(v) <= 0)
                    ? 'Giảm theo phần trăm bắt buộc phải có mức giảm tối đa' : null
            },
            { ten: 'don_toithieu', nhan: 'Hóa đơn tối thiểu (đồng)', kieu: 'number', giaTri: bg?.DON_TOITHIEU ?? 0 },
            {
                ten: 'diem_doi', nhan: 'Giá đổi (điểm) — để 0 nếu chỉ tặng', kieu: 'number',
                giaTri: bg?.DIEM_DOI ?? 0
            },
            {
                ten: 'hang_toithieu', nhan: 'Hạng tối thiểu', kieu: 'select',
                giaTri: bg?.HANG_TOITHIEU || 'dong',
                tuyChon: [
                    { giaTri: 'dong', nhan: 'Đồng — mọi thành viên' },
                    { giaTri: 'bac',  nhan: 'Bạc trở lên' },
                    { giaTri: 'vang', nhan: 'Vàng' },
                ]
            },
            {
                ten: 'so_ngay_hieuluc', nhan: 'Mã sống bao nhiêu ngày sau khi phát', kieu: 'number',
                giaTri: bg?.SO_NGAY_HIEULUC ?? 30, batBuoc: true,
                kiemTra: (v) => (Number(v) >= 1 && Number(v) <= 365)
                    ? null : 'Số ngày phải từ 1 đến 365'
            },
            { ten: 'ngay_batdau',  nhan: 'Chiến dịch bắt đầu (để trống = ngay)',   kieu: 'date', giaTri: bg?.NGAY_BATDAU },
            { ten: 'ngay_ketthuc', nhan: 'Chiến dịch kết thúc (để trống = mãi mãi)', kieu: 'date', giaTri: bg?.NGAY_KETTHUC },
            {
                ten: 'la_qua_tuan', nhan: 'Dùng làm quà tri ân hàng tuần', kieu: 'select',
                giaTri: bg?.LA_QUA_TUAN || 'false',
                tuyChon: [
                    { giaTri: 'false', nhan: 'Không' },
                    { giaTri: 'true',  nhan: 'Có — hệ thống tự phát mỗi tuần theo hạng' },
                ]
            },
            {
                ten: 'hoatdong', nhan: 'Trạng thái', kieu: 'select',
                giaTri: bg?.HOATDONG || 'true',
                tuyChon: [
                    { giaTri: 'true',  nhan: 'Đang bật' },
                    { giaTri: 'false', nhan: 'Tắt' },
                ]
            },
        ];
    }

    /* ══════════════════════════ XÓA ══════════════════════════ */

    /**
     * Chặn xóa ngay ở giao diện khi mẫu đã phát mã.
     *
     * Máy chủ cũng chặn (xem `quan_ly_voucher.php`), nhưng chặn sớm ở đây
     * để người dùng không phải bấm qua hộp thoại xác nhận rồi mới nhận lỗi.
     * Giao diện CHE, máy chủ NGĂN — cả hai đều cần.
     */
    kiemTraTruocKhiXoa(bg) {
        if (Number(bg.SO_MA_PHAT) > 0) {
            return `Voucher này đã phát ${bg.SO_MA_PHAT} mã cho khách nên không xóa được.\n\n`
                 + `Hãy TẮT nó thay vì xóa — mã cũ vẫn dùng được tới khi hết hạn, `
                 + `nhưng không ai đổi thêm được nữa.`;
        }
        return null;
    }

    canhBaoXoa(bg) {
        return `Voucher "${bg.TEN}" sẽ bị xóa khỏi hệ thống. `
             + `Chưa có mã nào được phát nên không ảnh hưởng tới khách.`;
    }

    /* ══════════════════════════ BẬT / TẮT ══════════════════════════ */

    async ganSuKienRieng(suKien) {
        const nut = suKien.target.closest('.nut-bat-tat');
        if (!nut) return;

        const bg = this._timBanGhi(nut.dataset.id);
        if (!bg) return;

        const dangBat = bg.HOATDONG === 'true';
        const dongY = await Dialog.xacNhan(
            dangBat ? 'Tắt voucher này?' : 'Bật lại voucher này?',
            dangBat
                ? `"${bg.TEN}" sẽ không còn đổi được nữa. `
                + `${bg.SO_MA_PHAT} mã đã phát vẫn dùng được tới khi hết hạn.`
                : `"${bg.TEN}" sẽ xuất hiện lại trong kho phiếu của khách.`,
            dangBat ? 'Tắt' : 'Bật lại'
        );
        if (!dongY) return;

        try {
            await ApiClient.ghi(this.endpointGhi, { action: 'toggle', mavoucher: bg.MAVOUCHER });
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    htmlRong() {
        return `<div class="py-10 text-center text-slate-400">
                    Chưa có voucher nào. Bấm <b class="text-gold-400">Thêm voucher</b> để tạo chương trình đầu tiên.
                </div>`;
    }
}
