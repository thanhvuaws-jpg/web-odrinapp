import { CrudScreen } from './CrudScreen.js';
import { ApiClient }  from '../core/ApiClient.js';
import { Dialog }     from '../core/Dialog.js';
import { Formatter }  from '../core/Formatter.js';
import { SocketBus }  from '../core/SocketBus.js';

/**
 * NguyenLieuScreen — màn hình quản lý danh mục nguyên vật liệu (bảng NGUYENLIEU).
 *
 * Kế thừa CrudScreen:
 * 1. Bảng danh sách hỗ trợ chuyển đổi giữa mặt hàng đang dùng và đã ngừng.
 * 2. Nút "Ngừng sử dụng" thay cho nút Xóa, kèm cảnh báo các món bị ảnh hưởng.
 * 3. Form thêm mới đặt TỒN = 0, form sửa TUYỆT ĐỐI KHÔNG cho sửa tồn kho (YC 7.4).
 */
export class NguyenLieuScreen extends CrudScreen {

    constructor() {
        super();
        this.xemDaNgung = false;
        this.danhSachNhom = [];
        this.donVi = [];
    }

    get tenHienThi()       { return 'nguyên liệu'; }
    get endpointDanhSach() { return 'kho_nguyenlieu.php'; }
    get endpointGhi()      { return 'kho_nguyenlieu.php'; }
    get khoaChinh()        { return 'manl'; }
    get selectorBang()     { return '#khoNguyenLieuNoiDung'; }

    suKienSauKhiGhi() { return ['inventory_changed']; }

    thamSoDanhSach() {
        return this.xemDaNgung ? { action: 'da_ngung' } : { action: 'danh_sach' };
    }

    docDuLieu(phanHoi) {
        return (phanHoi && phanHoi.danh_sach) || [];
    }

    /**
     * Nạp danh sách nhóm và đơn vị đo để đổ vào biểu mẫu.
     *
     * Đơn vị lấy từ máy chủ (action=don_vi), không gõ cứng ở đây: bản đầu
     * gõ cứng một danh sách có 'g', trong khi máy chủ chỉ nhận 'gam' — chọn
     * 'g' là bị từ chối. Máy chủ là nơi kiểm, nên máy chủ là nơi khai.
     */
    async napNhom() {
        if (this.danhSachNhom.length && this.donVi.length) return;
        try {
            const [kqNhom, kqDonVi] = await Promise.all([
                ApiClient.layDanhSach('kho_nguyenlieu.php', { action: 'nhom' }),
                ApiClient.layDanhSach('kho_nguyenlieu.php', { action: 'don_vi' })
            ]);
            this.danhSachNhom = kqNhom.danh_sach || [];
            this.donVi = [...(kqDonVi.do_luong || []), ...(kqDonVi.dem_duoc || [])];
        } catch (e) {
            this.danhSachNhom = [];
            this.donVi = [];
        }
    }

    cotBang() { return []; }

    htmlRong() {
        return `<div class="py-12 text-center text-gray-400">
                    <i class="fa-solid fa-box-open text-3xl mb-2 text-gray-600 block"></i>
                    ${this.xemDaNgung ? 'Không có nguyên liệu nào đã ngừng sử dụng.' : 'Chưa có nguyên liệu nào trong danh mục.'}
                </div>`;
    }

    veNoiDung(duLieu) {
        const dongHtml = duLieu.map(n => {
            const id = Formatter.an(n.MANL);
            const urlAnh = n.URL_ANH_NHO || n.URL_ANH;
            const anh = (n.LOAI_ANH === 'anh_noi_bo' && urlAnh)
                ? ApiClient.TIEN_TO + urlAnh
                : (urlAnh || null);

            const anhTag = anh
                ? `<img class="w-11 h-11 rounded-lg object-cover border border-gold-400/20"
                        src="${Formatter.an(anh)}" alt="${Formatter.an(n.TENNL)}" loading="lazy">`
                : `<div class="w-11 h-11 rounded-lg bg-black/40 border border-gold-400/20 grid place-items-center font-bold text-gray-400 text-sm">
                        ${Formatter.an(this.chuDau(n.TENNL))}
                   </div>`;

            // Trạng thái theo CHẾ ĐỘ đang xem: máy chủ đã lọc sẵn hai danh
            // sách, và không trả cột HOATDONG. Bản đầu đọc n.HOATDONG nên mọi
            // nguyên liệu đang dùng đều hiện "Đã ngừng" kèm nút "Dùng lại" —
            // không sửa hay ngừng được mặt hàng nào từ web.
            const tt = !this.xemDaNgung;
            const nutHanhDong = tt
                ? `<button class="nut-sua p-2 rounded-lg border border-gold-400/20 text-gold-400 hover:bg-gold-400/10 transition-all text-xs"
                           data-id="${id}" title="Sửa thông tin"><i class="fa-solid fa-pen"></i></button>
                   <button class="nut-ngung p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-xs ml-1.5"
                           data-id="${id}" data-ten="${Formatter.an(n.TENNL)}" title="Ngừng sử dụng">
                           <i class="fa-solid fa-ban"></i> Ngừng</button>`
                : `<button class="nut-dung-lai p-2 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all text-xs"
                           data-id="${id}" data-ten="${Formatter.an(n.TENNL)}" title="Kích hoạt dùng lại">
                           <i class="fa-solid fa-rotate-left mr-1"></i> Dùng lại</button>`;

            return `
                <tr class="border-b border-gold-400/10 hover:bg-black/20 transition-colors">
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            ${anhTag}
                            <div>
                                <span class="font-semibold text-white block text-sm">${Formatter.an(n.TENNL)}</span>
                                <span class="text-xs text-gray-400">#${id} · ${Formatter.an(n.TENNHOM || 'Chưa phân nhóm')}</span>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 rounded text-xs bg-gold-400/10 text-gold-300 font-mono">
                            ${Formatter.an(n.DONVI)}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right text-gray-300 text-sm">
                        ${this.soDep(n.TON_TOITHIEU)}
                    </td>
                    <td class="px-4 py-3 text-right text-gray-300 text-sm">
                        ${Formatter.tien(n.GIA_NHAP_GANNHAT || 0)} ₫
                    </td>
                    <td class="px-4 py-3 text-right font-bold ${parseFloat(n.TON_HIENTAI || 0) < 0 ? 'text-red-400' : 'text-gold-400'}">
                        ${this.soDep(n.TON_HIENTAI || 0)}
                    </td>
                    <td class="px-4 py-3 text-center">
                        ${tt ? `<span class="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Đang dùng</span>`
                            : `<span class="px-2 py-0.5 rounded-full text-[11px] bg-gray-500/15 text-gray-400 border border-gray-500/30">Đã ngừng</span>`}
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        ${nutHanhDong}
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="text-xs uppercase text-gray-400 border-b border-gold-400/20 bg-black/20">
                        <tr>
                            <th class="px-4 py-3">Nguyên liệu</th>
                            <th class="px-4 py-3 text-center">Đơn vị</th>
                            <th class="px-4 py-3 text-right">Tồn tối thiểu</th>
                            <th class="px-4 py-3 text-right">Giá nhập gần nhất</th>
                            <th class="px-4 py-3 text-right">Tồn hiện tại</th>
                            <th class="px-4 py-3 text-center">Trạng thái</th>
                            <th class="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">${dongHtml}</tbody>
                </table>
            </div>`;
    }

    chuDau(ten) {
        const tu = String(ten || '?').trim().split(/\s+/);
        if (tu.length === 1) return tu[0].charAt(0).toUpperCase();
        return (tu[0].charAt(0) + tu[tu.length - 1].charAt(0)).toUpperCase();
    }

    soDep(n) {
        const x = parseFloat(n || 0);
        return x.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
    }

    truongForm(bg) {
        const nhomOptions = (this.danhSachNhom || []).map(g => ({
            giaTri: g.MANHOM,
            nhan: `${g.TENNHOM} (${g.SO_NL || 0})`
        }));
        nhomOptions.unshift({ giaTri: '', nhan: '— Không phân nhóm —' });

        const donViList = this.donVi.length ? [...this.donVi] : ['kg'];
        if (bg?.DONVI && !donViList.includes(bg.DONVI)) donViList.push(bg.DONVI);
        const donViOptions = donViList.map(dv => ({ giaTri: dv, nhan: dv }));

        return [
            { ten: 'tennl', nhan: 'Tên nguyên liệu', batBuoc: true, giaTri: bg?.TENNL },
            { ten: 'manhom', nhan: 'Nhóm nguyên liệu', kieu: 'select', tuyChon: nhomOptions, giaTri: bg?.MANHOM || '' },
            { ten: 'donvi', nhan: 'Đơn vị đo', kieu: 'select', tuyChon: donViOptions, giaTri: bg?.DONVI || 'kg' },
            { ten: 'ton_toithieu', nhan: 'Mức tồn tối thiểu', kieu: 'number', giaTri: bg ? bg.TON_TOITHIEU : 0,
              kiemTra: v => (parseFloat(v) < 0 ? 'Mức tồn tối thiểu không được âm' : null) },
            { ten: 'gia_nhap', nhan: 'Giá nhập ước tính / gần nhất (₫)', kieu: 'number', giaTri: bg ? bg.GIA_NHAP_GANNHAT : 0,
              kiemTra: v => (parseFloat(v) < 0 ? 'Giá nhập không được âm' : null) },
            { ten: 'ghichu', nhan: 'Ghi chú', kieu: 'textarea', giaTri: bg?.GHICHU || '' }
        ];
    }

    async chuanBiDuLieuGui(duLieuForm) {
        // Ánh xạ action sang API chuẩn của kho_nguyenlieu.php
        const actionGui = duLieuForm.action === 'add' ? 'them' : 'sua';
        return {
            ...duLieuForm,
            action: actionGui
        };
    }

    ganSuKienRieng(e, khung) {
        // Xử lý nút Ngừng sử dụng
        const nutNgung = e.target.closest('.nut-ngung');
        if (nutNgung) {
            const id = nutNgung.dataset.id;
            const ten = nutNgung.dataset.ten;
            this.xuLyNgung(id, ten);
            return;
        }

        // Xử lý nút Dùng lại
        const nutDungLai = e.target.closest('.nut-dung-lai');
        if (nutDungLai) {
            const id = nutDungLai.dataset.id;
            const ten = nutDungLai.dataset.ten;
            this.xuLyDungLai(id, ten);
            return;
        }
    }

    async xuLyNgung(id, ten) {
        const dongY = await Dialog.xacNhan(
            `Ngừng sử dụng "${ten}"?`,
            'Nguyên liệu sẽ không còn xuất hiện trong danh sách tồn kho hoạt động. Lịch sử sổ kho vẫn được bảo toàn nguyên vẹn.',
            'Ngừng sử dụng'
        );
        if (!dongY) return;

        try {
            const res = await ApiClient.ghi(this.endpointGhi, {
                action: 'ngung',
                manl: id
            });

            if (res.mon_anh_huong && res.mon_anh_huong.length > 0) {
                const dsMon = res.mon_anh_huong.join(', ');
                await Dialog.canhBao(
                    'Đã ngừng sử dụng',
                    `${res.message}\n\nLưu ý: Nguyên liệu này vẫn đang có trong công thức của các món: ${dsMon}. Hãy cập nhật lại định lượng của món ăn!`
                );
            } else {
                Dialog.thanhCong('Đã ngừng sử dụng', res.message);
            }

            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    async xuLyDungLai(id, ten) {
        const dongY = await Dialog.xacNhan(
            `Kích hoạt lại "${ten}"?`,
            'Nguyên liệu sẽ xuất hiện trở lại trong danh sách tồn kho và cho phép nhập xuất.',
            'Kích hoạt'
        );
        if (!dongY) return;

        try {
            const res = await ApiClient.ghi(this.endpointGhi, {
                action: 'dung_lai',
                manl: id
            });
            Dialog.thanhCong('Đã kích hoạt lại', res.message);
            SocketBus.phatNhieu(this.suKienSauKhiGhi());
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /** Chuyển đổi giữa danh sách đang dùng và đã ngừng */
    async chuyenCheDo(xemDaNgung) {
        this.xemDaNgung = xemDaNgung;
        await this.nap();
    }
}
