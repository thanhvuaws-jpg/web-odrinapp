import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';

/**
 * DuBaoPanel — thẻ con "Dự báo" trong màn hình kho.
 *
 * Dự báo lượng nguyên liệu cần cho một ngày, cho người dùng sửa từng số,
 * rồi chốt thành một phiếu nhập thật.
 *
 *
 * VÌ SAO NẰM TRONG MÀN KHO, KHÔNG PHẢI MỘT TAB RIÊNG
 * ===================================================
 * Thứ nó sinh ra là một PHIẾU NHẬP. Người dùng đọc dự báo, so với tồn kho
 * hiện có, chốt đơn, rồi in phiếu — cả bốn việc đều ở màn kho. Tách ra tab
 * riêng thì phải nhảy qua lại giữa hai tab chỉ để làm một việc.
 *
 *
 * "VÌ SAO TIN ĐƯỢC CON SỐ NÀY" ĐẶT LÊN ĐẦU
 * ========================================
 * Một bảng số dự báo đứng một mình không nói được gì: 27% sai số là tốt
 * hay tệ? Nên ngay trên bảng là ba con số tự chấm điểm của mô hình, trong
 * đó có phép so với hai cách làm ngây thơ (trung bình 7 ngày, tuần trước
 * cùng thứ) — thứ duy nhất chứng minh được mô hình có ích (QĐ-080).
 *
 *
 * NGƯỜI DÙNG LUÔN CÓ QUYỀN SỬA
 * ============================
 * Dự báo là gợi ý, không phải mệnh lệnh. Bếp trưởng biết mai có tiệc cưới
 * 80 người mà dữ liệu bán hàng thì không biết. Mọi ô "đặt" đều sửa được,
 * và phiếu chốt theo ĐÚNG số trên màn hình — máy chủ không tính lại dự báo
 * lúc chốt (xem kho_dubao.php), nếu không người dùng sẽ đặt một lượng mà
 * họ chưa từng nhìn thấy.
 */
export class DuBaoPanel {

    constructor(manHinhKho) {
        this.kho      = manHinhKho;   // mượn anhNguyenLieu / soDep / chuDau
        this.ngay     = null;         // YYYY-MM-DD đang xem
        this.duLieu   = null;
        this.chamDiem = null;
        this.banChay  = [];
        this.sua      = new Map();    // manl -> số lượng người dùng đã sửa
    }

    /* ══════════════════════════ Ngày ══════════════════════════ */

    static _yyyymmdd(d) {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const n = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${n}`;
    }

    static ngayMai() {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return DuBaoPanel._yyyymmdd(d);
    }

    /** Thứ Bảy gần nhất SAU ngày mai — ngày đông nhất tuần, để thấy mùa vụ. */
    static thuBayToi() {
        const d = new Date(); d.setDate(d.getDate() + 2);
        while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
        return DuBaoPanel._yyyymmdd(d);
    }

    static tenThu(yyyymmdd) {
        const d = new Date(yyyymmdd + 'T00:00:00');
        return ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
    }

    /* ══════════════════════════ Nạp ══════════════════════════ */

    async nap(ngay = null) {
        this.ngay = ngay || this.ngay || DuBaoPanel.ngayMai();
        this.sua.clear();

        // Chấm điểm và bestseller không phụ thuộc ngày đang xem — chỉ nạp
        // một lần. Chấm điểm chạy lại cả mô hình trên 14 ngày quá khứ, bắt
        // chờ lại mỗi lần đổi ngày là phí vô ích.
        const [dubao, cham, ban] = await Promise.all([
            ApiClient.layDanhSach('kho_dubao.php', { action: 'dubao', ngay: this.ngay }),
            this.chamDiem ? null : ApiClient.layDanhSach('kho_dubao.php', { action: 'chamdiem', so_ngay: 14 }),
            this.banChay.length ? null : ApiClient.layDanhSach('kho_dubao.php',
                                                   { action: 'bestseller', so_ngay: 30, gioi_han: 6 })
        ]);
        this.duLieu = dubao;
        if (cham) this.chamDiem = cham.danh_gia;
        if (ban)  this.banChay  = ban.danh_sach || [];
        this.ve();
    }

    /* ══════════════════════════ Vẽ ══════════════════════════ */

    ve() {
        const thanh = document.getElementById('khoThanh');
        const noi   = document.getElementById('khoNoiDung');
        if (!thanh || !noi || !this.duLieu) return;

        const nm = DuBaoPanel.ngayMai(), t7 = DuBaoPanel.thuBayToi();
        const nutNgay = (ngay, nhan) => `
            <button data-hanhdong="dubao-ngay" data-ngay="${ngay}"
              class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                     ${this.ngay === ngay ? 'bg-gold-400 text-royal-900 border-gold-400'
                                          : 'border-gold-400/30 text-gold-400 hover:bg-gold-400/10'}">
              ${nhan}</button>`;

        thanh.innerHTML = `
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-gray-300">Dự báo cho
                <b class="text-white">${DuBaoPanel.tenThu(this.ngay)}, ${Formatter.ngay(this.ngay)}</b></span>
              ${nutNgay(nm, 'Ngày mai')}
              ${t7 !== nm ? nutNgay(t7, 'Thứ 7 tới') : ''}
              <input type="date" data-hanhdong="dubao-chon-ngay" value="${this.ngay}"
                class="px-2 py-1 rounded-lg bg-black/20 border border-gold-400/20 text-xs">
            </div>
            <div class="ml-auto text-sm text-gray-300">Ước tính
              <b id="dbTong" class="text-gold-400 text-base">${Formatter.tien(this._tongTien())} ₫</b></div>
            <button data-hanhdong="dubao-chot" id="dbNutChot"
              class="px-4 py-2 rounded-lg bg-gold-400 text-royal-900 text-sm font-bold
                     hover:bg-gold-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <i class="fa-solid fa-file-circle-check mr-1.5"></i>Chốt thành phiếu nhập</button>`;

        const ds = [...(this.duLieu.tat_ca || [])]
            // Cần đặt lên đầu, trong đó thứ tốn tiền nhất lên trước: người
            // duyệt đơn nhìn vào đầu bảng là thấy ngay khoản nào đáng soi.
            .sort((a, b) => (b.can_dat > 0) - (a.can_dat > 0) || b.uoc_tien - a.uoc_tien);

        noi.innerHTML = `
          <div class="space-y-5">
            ${this._veChamDiem()}
            <div class="grid grid-cols-1 xl:grid-cols-4 gap-5">
              <div class="xl:col-span-3 space-y-2">${ds.map(r => this._dong(r)).join('')}</div>
              <div>${this._veBanChay()}</div>
            </div>
          </div>`;

        this._capNhatNutChot();
    }

    _veChamDiem() {
        const d = this.chamDiem;
        if (!d) return '';

        const hon = (d.wmape_tb_7ngay ?? 0) - (d.wmape ?? 0);
        const o = (nhan, so, phu, mau) => `
            <div class="bg-black/20 border border-gold-400/10 rounded-xl p-4">
              <div class="text-xs text-gray-400 uppercase tracking-wider">${nhan}</div>
              <div class="text-2xl font-bold mt-1 ${mau}">${so}</div>
              <div class="text-xs text-gray-500 mt-1">${phu}</div>
            </div>`;

        return `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${o('Sai số mô hình', `${d.wmape}%`,
                'Có trọng số theo khối lượng, tự chấm trên 14 ngày qua', 'text-gold-400')}
            ${o('So với cách làm tay', hon > 0 ? `tốt hơn ${hon.toFixed(1)} điểm` : 'không hơn',
                `Trung bình 7 ngày: ${d.wmape_tb_7ngay}% · Tuần trước cùng thứ: ${d.wmape_tuan_truoc}%`,
                hon > 0 ? 'text-emerald-400' : 'text-orange-400')}
            ${o('Đặt theo dự báo thì đủ hàng', `${d.ty_le_du_hang}% số lần`,
                'Thiết kế cho khoảng 85% — hàng tươi đặt dư là phải hủy', 'text-emerald-400')}
          </div>`;
    }

    _veBanChay() {
        if (!this.banChay.length) return '';
        const muiTen = x => x === 'tang' ? '<span class="text-emerald-400">▲</span>'
                          : x === 'giam' ? '<span class="text-red-400">▼</span>'
                          : x === 'moi'  ? '<span class="text-sky-400 text-[10px]">MỚI</span>'
                          : '<span class="text-gray-500">—</span>';
        return `
          <div class="bg-black/20 border border-gold-400/10 rounded-xl p-4 sticky top-4">
            <div class="text-xs text-gray-400 uppercase tracking-wider mb-3">
              <i class="fa-solid fa-fire text-orange-400 mr-1"></i>Bán chạy 30 ngày</div>
            <div class="space-y-2">
              ${this.banChay.map(m => `
                <div class="flex items-center gap-2 text-sm">
                  <span class="w-5 text-center font-bold ${m.HANG <= 3 ? 'text-gold-400' : 'text-gray-500'}">${m.HANG}</span>
                  <span class="flex-1 truncate">${Formatter.an(m.TENMON)}</span>
                  <span class="text-xs text-gray-400">${m.TB_MOI_NGAY}/ngày</span>
                  <span class="w-8 text-right">${muiTen(m.XU_HUONG)}</span>
                </div>`).join('')}
            </div>
            <div class="text-[11px] text-gray-500 mt-3 leading-snug">
              Dự báo nguyên liệu tính từ chính lượng bán của các món này, qua bảng định lượng.
            </div>
          </div>`;
    }

    _dong(r) {
        const can = this.sua.has(r.manl) ? this.sua.get(r.manl) : r.can_dat;
        const coDat = can > 0;
        const buoc = ['quả', 'cái', 'gói', 'lon', 'chai', 'hộp', 'bó'].includes(r.donvi) ? 1 : 0.1;

        // Tên lớp Tailwind đầy đủ, không ghép động — xem QĐ-024.
        return `
          <details class="group bg-black/20 border rounded-xl transition-all
                          ${coDat ? 'border-gold-400/25' : 'border-gold-400/5 opacity-60 hover:opacity-100'}">
            <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
              <div class="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-black/30 grid place-items-center">
                ${this.kho.anhNguyenLieu({ ...r, TENNL: r.tennl })}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">${Formatter.an(r.tennl)}
                  ${r.du_tin_cay ? '' : '<span class="text-[10px] text-orange-400 ml-1">ít dữ liệu</span>'}</div>
                <div class="text-xs text-gray-400">
                  cần ${this.kho.soDep(r.nhu_cau)} + đệm ${this.kho.soDep(r.ton_an_toan)}
                  − tồn ${this.kho.soDep(r.ton_hientai)} ${Formatter.an(r.donvi)}
                </div>
              </div>
              <label class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
                <span class="text-xs text-gray-400">Đặt</span>
                <input type="number" min="0" step="${buoc}" value="${this.kho.soDep(can).replace(',', '.')}"
                  data-dubao-manl="${r.manl}"
                  class="w-20 px-2 py-1 rounded-lg bg-black/30 border border-gold-400/25 text-right text-sm
                         font-bold focus:outline-none focus:border-gold-400">
                <span class="text-xs text-gray-400 w-8">${Formatter.an(r.donvi)}</span>
              </label>
              <div class="w-24 text-right shrink-0 text-sm font-semibold text-gold-400" data-dubao-tien="${r.manl}">
                ${coDat ? Formatter.tien(Math.round(can * r.gia_nhap)) + ' ₫' : '—'}</div>
              <i class="fa-solid fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i>
            </summary>
            <div class="px-4 pb-3 pl-[4.5rem] text-xs text-gray-400 leading-relaxed">
              ${Formatter.an(r.diengiai)}
            </div>
          </details>`;
    }

    /* ══════════════════════ Sửa số và chốt đơn ══════════════════════ */

    /** Người dùng sửa một ô "Đặt" — cập nhật tiền dòng đó và tổng. */
    suaSoLuong(manl, giaTri) {
        const r = (this.duLieu.tat_ca || []).find(x => x.manl === manl);
        if (!r) return;
        const so = Math.max(0, parseFloat(giaTri) || 0);
        this.sua.set(manl, so);

        const o = document.querySelector(`[data-dubao-tien="${manl}"]`);
        if (o) o.textContent = so > 0 ? Formatter.tien(Math.round(so * r.gia_nhap)) + ' ₫' : '—';

        const tong = document.getElementById('dbTong');
        if (tong) tong.textContent = Formatter.tien(this._tongTien()) + ' ₫';
        this._capNhatNutChot();
    }

    _dongSeChot() {
        return (this.duLieu?.tat_ca || [])
            .map(r => ({ r, sl: this.sua.has(r.manl) ? this.sua.get(r.manl) : r.can_dat }))
            .filter(x => x.sl > 0);
    }

    _tongTien() {
        return this._dongSeChot().reduce((t, x) => t + Math.round(x.sl * x.r.gia_nhap), 0);
    }

    _capNhatNutChot() {
        const nut = document.getElementById('dbNutChot');
        if (!nut) return;
        const n = this._dongSeChot().length;
        nut.disabled = n === 0;
        nut.innerHTML = `<i class="fa-solid fa-file-circle-check mr-1.5"></i>` +
                        (n ? `Chốt ${n} mặt hàng thành phiếu nhập` : 'Không có gì cần đặt');
    }

    async chot() {
        const dong = this._dongSeChot();
        if (!dong.length) return;

        const tong = this._tongTien();
        const dongY = await Dialog.xacNhan(
            'Chốt phiếu nhập?',
            `${dong.length} mặt hàng, tổng ${Formatter.tien(tong)} ₫, cho ${DuBaoPanel.tenThu(this.ngay)} ` +
            `${Formatter.ngay(this.ngay)}. Tồn kho sẽ tăng ngay khi chốt.`,
            'Chốt và nhập kho');
        if (!dongY) return;

        const kq = await ApiClient.ghi('kho_dubao.php', {
            action: 'chot_don',
            ngay: this.ngay,
            nhacungcap: 'Đặt theo dự báo',
            dong: JSON.stringify(dong.map(x => ({
                manl: x.r.manl, soluong: x.sl, dongia: x.r.gia_nhap
            })))
        });

        await Dialog.thanhCong('Đã nhập kho', kq.message);
        if (await Dialog.xacNhan('In phiếu nhập?', kq.phieu.so_phieu, 'In ngay')) {
            await this.kho.inPhieu('nhap', kq.phieu.maphieunhap);
        }
        // Tồn đã tăng nên dự báo "cần đặt" phải giảm theo — nạp lại để thấy.
        await this.nap(this.ngay);
    }
}
