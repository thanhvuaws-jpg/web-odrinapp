import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';

/**
 * HanSuDungPanel — bảng điều khiển cảnh báo hạn sử dụng nguyên vật liệu theo dòng nhập kho.
 *
 * Căn cứ Yêu cầu 8 (8.1 - 8.5):
 * 1. Cảnh báo các dòng Phiếu nhập có Hạn sử dụng sắp hết (trong vòng 7 ngày) hoặc đã quá hạn.
 * 2. Cung cấp thông tin chi tiết: Tên nguyên liệu, số phiếu nhập, số lượng đã nhập, hạn sử dụng,
 *    số ngày còn lại và giá trị rủi ro ước tính.
 * 3. Ghi chú minh bạch: Theo dõi theo dòng phiếu nhập để thủ kho & bếp ưu tiên dùng trước (FIFO).
 */
export class HanSuDungPanel {

    constructor(khoScreen) {
        this.khoScreen = khoScreen;
        this.duLieu = null;
        this.nguong = 7;
        this.container = null;
        this._khungDaGan = null;
    }

    async khoiDong(container) {
        this.container = container || document.getElementById('khoNoiDung');
        this._veKhung();
        this._ganSuKien();
        await this.nap();
    }

    async nap(nguong = 7) {
        this.nguong = nguong;
        try {
            const res = await ApiClient.layDanhSach('kho_nguyenlieu.php', {
                action: 'canh_bao_han',
                nguong: this.nguong
            });
            this.duLieu = res;
            this._veNoiDung();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    _veKhung() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="space-y-5">
                <!-- Thanh công cụ & bộ lọc ngưỡng ngày -->
                <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-black/20 border border-gold-400/10 rounded-xl">
                    <div class="flex items-center gap-2 text-sm text-gray-300">
                        <i class="fa-solid fa-calendar-xmark text-gold-400"></i>
                        <span class="font-semibold">Cảnh báo hạn sử dụng nguyên vật liệu</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-gray-400">Ngưỡng cảnh báo:</label>
                        <select id="hsdNguongNgay" class="px-2.5 py-1 rounded bg-black/40 border border-gold-400/20 text-xs text-gold-300 focus:outline-none focus:border-gold-400">
                            <option value="3" ${this.nguong === 3 ? 'selected' : ''}>Trong 3 ngày</option>
                            <option value="7" ${this.nguong === 7 ? 'selected' : ''}>Trong 7 ngày (chuẩn)</option>
                            <option value="14" ${this.nguong === 14 ? 'selected' : ''}>Trong 14 ngày</option>
                            <option value="30" ${this.nguong === 30 ? 'selected' : ''}>Trong 30 ngày</option>
                        </select>
                        <button id="hsdNutLamMoi" class="px-3 py-1 rounded bg-gold-400/10 border border-gold-400/20 text-gold-400 hover:bg-gold-400/20 text-xs font-bold transition-all">
                            <i class="fa-solid fa-rotate-right mr-1"></i>Làm mới
                        </button>
                    </div>
                </div>

                <!-- Vùng nội dung chi tiết -->
                <div id="hsdVungNoiDung"></div>
            </div>`;
    }

    _veNoiDung() {
        const o = document.getElementById('hsdVungNoiDung');
        if (!o || !this.duLieu) return;

        const hetHan = this.duLieu.het_han || [];
        const sapHet = this.duLieu.sap_het_han || [];
        // Tên trường theo kho_canh_bao_han(): so_sap_het_han và GIA_TRI. Bản
        // đầu đọc so_sap_het và GIATRI_RUI_RO — không trường nào tồn tại, nên
        // thẻ "sắp hết hạn" và mọi con số tiền đều hiện 0.
        const tongHetHan = this.duLieu.so_het_han || 0;
        const tongSapHet = this.duLieu.so_sap_het_han || 0;

        // Tính tổng giá trị rủi ro
        const ruiRoHet = hetHan.reduce((sum, r) => sum + parseFloat(r.GIA_TRI || 0), 0);
        const ruiRoSap = sapHet.reduce((sum, r) => sum + parseFloat(r.GIA_TRI || 0), 0);

        const theThongKe = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div class="flex items-center justify-between">
                        <span class="text-xs uppercase font-bold text-red-400 tracking-wider">Đã quá hạn sử dụng</span>
                        <i class="fa-solid fa-triangle-exclamation text-red-400 text-lg"></i>
                    </div>
                    <div class="text-2xl font-bold text-red-400 mt-2">${tongHetHan} <span class="text-sm font-normal text-gray-400">lô hàng</span></div>
                    <div class="text-xs text-gray-400 mt-1">Ước tính thiệt hại: <span class="font-bold text-red-300 font-mono">${Formatter.tien(ruiRoHet)} ₫</span></div>
                </div>
                <div class="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                    <div class="flex items-center justify-between">
                        <span class="text-xs uppercase font-bold text-yellow-400 tracking-wider">Sắp hết hạn (≤ ${this.nguong} ngày)</span>
                        <i class="fa-solid fa-clock-rotate-left text-yellow-400 text-lg"></i>
                    </div>
                    <div class="text-2xl font-bold text-yellow-400 mt-2">${tongSapHet} <span class="text-sm font-normal text-gray-400">lô hàng</span></div>
                    <div class="text-xs text-gray-400 mt-1">Giá trị cần ưu tiên dùng: <span class="font-bold text-yellow-300 font-mono">${Formatter.tien(ruiRoSap)} ₫</span></div>
                </div>
            </div>`;

        const renderBang = (danhSach, laHetHan) => {
            if (!danhSach.length) {
                return `<div class="py-6 text-center text-xs text-gray-500 bg-black/20 rounded-lg border border-white/5">
                            Không có lô hàng nào ${laHetHan ? 'bị quá hạn' : 'sắp hết hạn trong khoảng này'}.
                        </div>`;
            }

            const dong = danhSach.map((r, i) => {
                const conLai = parseInt(r.CON_LAI, 10);
                const daDungHet = Boolean(r.DA_DUNG_HET);

                let nhanHan = '';
                if (conLai < 0) {
                    nhanHan = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">Quá hạn ${Math.abs(conLai)} ngày</span>`;
                } else if (conLai === 0) {
                    nhanHan = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">Hôm nay</span>`;
                } else {
                    nhanHan = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Còn ${conLai} ngày</span>`;
                }

                return `
                    <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td class="py-2.5 text-center text-xs text-gray-500">${i + 1}</td>
                        <td class="py-2.5">
                            <span class="font-semibold text-white block text-sm">${Formatter.an(r.TENNL)}</span>
                            <span class="text-xs text-gray-400">Số phiếu: <b class="text-gold-400/80">${Formatter.an(r.SO_PHIEU)}</b> · Nhập ngày ${Formatter.ngay(r.NGAYNHAP)}</span>
                        </td>
                        <td class="py-2.5 text-right font-mono font-bold text-gray-200">
                            ${parseFloat(r.SOLUONG).toLocaleString('vi-VN')} <span class="text-xs text-gray-400">${Formatter.an(r.DONVI)}</span>
                        </td>
                        <td class="py-2.5 text-center font-mono text-sm text-gray-300">
                            ${Formatter.ngay(r.HANSUDUNG)}
                        </td>
                        <td class="py-2.5 text-center">
                            ${nhanHan}
                        </td>
                        <td class="py-2.5 text-right font-mono font-bold ${laHetHan ? 'text-red-400' : 'text-gold-300'}">
                            ${Formatter.tien(r.GIA_TRI || 0)} ₫
                        </td>
                        <td class="py-2.5 text-center">
                            ${daDungHet ? `<span class="text-[10px] text-gray-500 font-mono" title="Tồn kho của nguyên liệu này hiện đã hết">Đã dùng hết</span>`
                                        : `<span class="text-[10px] text-emerald-400 font-mono" title="Kho vẫn còn hàng">Còn tồn</span>`}
                        </td>
                    </tr>`;
            }).join('');

            return `
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="uppercase text-gray-400 border-b border-white/10 bg-black/20">
                            <tr>
                                <th class="py-2.5 px-2 text-center w-8">TT</th>
                                <th class="py-2.5">Nguyên liệu & Lô nhập</th>
                                <th class="py-2.5 text-right">SL nhập</th>
                                <th class="py-2.5 text-center">Hạn sử dụng</th>
                                <th class="py-2.5 text-center">Tình trạng</th>
                                <th class="py-2.5 text-right">Giá trị lô</th>
                                <th class="py-2.5 text-center">Trạng thái kho</th>
                            </tr>
                        </thead>
                        <tbody>${dong}</tbody>
                    </table>
                </div>`;
        };

        o.innerHTML = `
            ${theThongKe}

            <!-- Nhóm Đã quá hạn -->
            <div class="p-4 rounded-xl border border-red-500/20 bg-black/20 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-ban text-red-400"></i>
                        <h4 class="text-sm font-bold text-red-400 uppercase tracking-wide">Các lô hàng đã quá hạn (${tongHetHan})</h4>
                    </div>
                    <span class="text-xs text-gray-400">Cần kiểm tra thực tế để lập biên bản hủy nếu đã hỏng</span>
                </div>
                ${renderBang(hetHan, true)}
            </div>

            <!-- Nhóm Sắp hết hạn -->
            <div class="p-4 rounded-xl border border-yellow-500/20 bg-black/20 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation text-yellow-400"></i>
                        <h4 class="text-sm font-bold text-yellow-400 uppercase tracking-wide">Các lô hàng cận hạn trong ${this.nguong} ngày (${tongSapHet})</h4>
                    </div>
                    <span class="text-xs text-gray-400">Ưu tiên xuất dùng trước (FIFO) trong ca nấu</span>
                </div>
                ${renderBang(sapHet, false)}
            </div>

            <!-- Ghi chú nguyên tắc FIFO & giới hạn kỹ thuật -->
            <div class="p-3 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-400 flex items-start gap-2.5">
                <i class="fa-solid fa-circle-info text-gold-400 text-sm mt-0.5"></i>
                <div class="leading-relaxed">
                    <b>Nguyên tắc theo dõi:</b> Hạn sử dụng được tính dựa trên từng dòng Phiếu nhập hàng thực tế. Hệ thống quản lý kho tổng nên cờ <i>"Còn tồn"</i> cho biết mặt hàng đó hiện vẫn còn tồn trong kho, giúp bếp và thủ kho ưu tiên xuất chế biến các lô nhập sớm hơn nhằm tránh lãng phí.
                </div>
            </div>`;
    }

    _ganSuKien() {
        // So theo phần tử, không theo cờ: khung #khoNoiDung bị KhoScreen vẽ
        // lại mỗi lần chuyển tab, nên cờ đã-gắn làm lần mở thứ hai mất hết
        // sự kiện (đổi ngưỡng, Làm mới không phản hồi).
        if (!this.container || this.container === this._khungDaGan) return;
        this._khungDaGan = this.container;

        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'hsdNguongNgay') {
                this.nap(parseInt(e.target.value, 10));
            }
        });

        this.container.addEventListener('click', (e) => {
            if (e.target.closest('#hsdNutLamMoi')) {
                this.nap(this.nguong);
            }
        });
    }
}
