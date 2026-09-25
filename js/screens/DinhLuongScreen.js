import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';
import { SocketBus } from '../core/SocketBus.js';

/**
 * DinhLuongScreen — màn hình quản lý công thức định lượng món ăn (bảng DINH_LUONG).
 *
 * Cho phép:
 * 1. Xem danh sách món ăn, nhận biết món nào đã có công thức, món nào chưa có.
 * 2. Xem chi tiết công thức, giá vốn ước tính và tỷ lệ giá vốn (Food Cost %) của từng món.
 * 3. Thêm mới nguyên liệu vào công thức (chặn nguyên liệu đã ngừng).
 * 4. Chỉnh sửa số lượng tiêu hao và xóa nguyên liệu khỏi công thức.
 */
export class DinhLuongScreen {

    constructor(khoScreen) {
        this.khoScreen = khoScreen;
        this.danhSachMon = [];
        this.soChuaCo = 0;
        this.mamonDangChon = null;
        this.chiTiet = null;
        this.boLoc = { tukhoa: '', chi_chua_co: false };
        this._khungDaGan = null;
    }

    async khoiDong(container) {
        this.container = container || document.getElementById('khoNoiDung');
        this._veKhung();
        this._ganSuKien();
        await this.nap();
    }

    async nap() {
        try {
            // action=mon: gọi không kèm action thì máy chủ hiểu là đọc công
            // thức MỘT món và trả 400 "thiếu mã món" — bản đầu gọi như vậy
            // nên cả màn hình báo lỗi ngay khi mở. Khóa trả về viết HOA
            // (MAMON, TENMON…), theo kho_mon_va_so_dong().
            const kqMon = await ApiClient.layDanhSach('kho_dinhluong.php', { action: 'mon' });
            this.danhSachMon = kqMon.danh_sach || [];
            this.soChuaCo = kqMon.so_chua_cong_thuc || 0;

            // Nếu chưa chọn món nào hoặc món cũ không còn, chọn món đầu tiên
            if (!this._timMon(this.mamonDangChon) && this.danhSachMon.length > 0) {
                this.mamonDangChon = Number(this.danhSachMon[0].MAMON);
            }

            const nhanChuaCo = document.getElementById('dlSoChuaCo');
            if (nhanChuaCo) nhanChuaCo.textContent = this.soChuaCo;
            this._veDanhSachMon();

            if (this.mamonDangChon) {
                await this.napChiTiet(this.mamonDangChon);
            }
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    _timMon(mamon) {
        return this.danhSachMon.find(m => Number(m.MAMON) === Number(mamon)) || null;
    }

    async napChiTiet(mamon) {
        this.mamonDangChon = mamon;
        this._danhDauMonDangChon();
        try {
            const kq = await ApiClient.layDanhSach('kho_dinhluong.php', { mamon });
            this.chiTiet = kq;
            this._veChiTiet();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    _veKhung() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <!-- Cột trái: Danh sách món (5 cols) -->
                <div class="lg:col-span-5 flex flex-col gap-3">
                    <div class="p-3 bg-black/20 border border-gold-400/10 rounded-xl space-y-2">
                        <div class="flex items-center gap-2">
                            <input type="text" id="dlTimKiemMon" placeholder="Tìm món ăn…"
                                   class="w-full px-3 py-1.5 rounded-lg bg-black/30 border border-gold-400/20 text-xs text-white focus:outline-none focus:border-gold-400">
                        </div>
                        <div class="flex items-center justify-between text-xs text-gray-400">
                            <label class="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" id="dlLocChuaCo" class="accent-gold-400">
                                <span>Chỉ món chưa có công thức (<span id="dlSoChuaCo">${this.soChuaCo}</span>)</span>
                            </label>
                            <span id="dlDemMon" class="font-mono text-[11px]"></span>
                        </div>
                    </div>
                    <div id="dlVungDanhSachMon" class="space-y-1.5 max-h-[640px] overflow-y-auto pr-1"></div>
                </div>

                <!-- Cột phải: Bảng công thức định lượng (7 cols) -->
                <div class="lg:col-span-7 flex flex-col gap-4">
                    <div id="dlVungChiTiet" class="bg-black/20 border border-gold-400/10 rounded-xl p-4 min-h-[400px]">
                        <div class="py-20 text-center text-gray-400">
                            <i class="fa-solid fa-mortar-pestle text-3xl mb-2 text-gray-600 block"></i>
                            Chọn một món ăn bên trái để cấu hình công thức định lượng.
                        </div>
                    </div>
                </div>
            </div>`;
    }

    _veDanhSachMon() {
        const o = document.getElementById('dlVungDanhSachMon');
        const dem = document.getElementById('dlDemMon');
        if (!o) return;

        let ds = this.danhSachMon;
        if (this.boLoc.tukhoa) {
            const tk = Formatter.boDau(this.boLoc.tukhoa);
            ds = ds.filter(m => Formatter.boDau(m.TENMON).includes(tk));
        }
        if (this.boLoc.chi_chua_co) {
            ds = ds.filter(m => Number(m.SO_NGUYEN_LIEU || 0) === 0);
        }

        if (dem) dem.textContent = `${ds.length} món`;

        if (!ds.length) {
            o.innerHTML = `<div class="py-10 text-center text-xs text-gray-500">Không có món ăn nào khớp bộ lọc.</div>`;
            return;
        }

        o.innerHTML = ds.map(m => {
            const chon = Number(m.MAMON) === Number(this.mamonDangChon);
            const chuaCo = Number(m.SO_NGUYEN_LIEU || 0) === 0;
            const anh = m.HINHANH || 'https://placehold.co/100x100?text=Food';

            return `
                <div data-mamon="${m.MAMON}"
                     class="dl-the-mon flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
                            ${chon ? 'bg-gold-400/10 border-gold-400 text-white shadow-sm'
                                   : 'bg-black/20 border-white/5 hover:border-gold-400/30 text-gray-300'}">
                    <img src="${Formatter.an(anh)}" alt="" class="w-10 h-10 rounded-md object-cover border border-white/10 shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-sm truncate">${Formatter.an(m.TENMON)}</div>
                        <div class="text-[11px] text-gray-400 truncate">
                            ${Formatter.an(m.TENLOAI || '')} · <span class="text-gold-300">${Formatter.tien(m.GIATIEN)} ₫</span>
                        </div>
                    </div>
                    <div class="shrink-0 text-right">
                        ${chuaCo
                            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">Chưa có</span>`
                            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gold-400/10 text-gold-400 border border-gold-400/20">${m.SO_NGUYEN_LIEU} NL</span>`}
                    </div>
                </div>`;
        }).join('');
    }

    _danhDauMonDangChon() {
        const o = document.getElementById('dlVungDanhSachMon');
        if (!o) return;
        o.querySelectorAll('.dl-the-mon').forEach(the => {
            const chon = Number(the.dataset.mamon) === Number(this.mamonDangChon);
            the.className = `dl-the-mon flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                chon ? 'bg-gold-400/10 border-gold-400 text-white shadow-sm'
                     : 'bg-black/20 border-white/5 hover:border-gold-400/30 text-gray-300'
            }`;
        });
    }

    _veChiTiet() {
        const o = document.getElementById('dlVungChiTiet');
        if (!o || !this.chiTiet) return;

        // Giá vốn và tỷ lệ nằm TRONG `mon` (kho_dinh_luong_cua_mon), không ở
        // gốc phản hồi. Ảnh và nhóm món không có trong `mon`, lấy từ danh
        // sách món đã nạp.
        const m = this.chiTiet.mon || {};
        const tuDs = this._timMon(m.MAMON) || {};
        const ds = this.chiTiet.danh_sach || [];
        const giaVon = Number(m.GIA_VON || 0);
        const tyLe = m.TY_LE_GIA_VON;   // null khi món chưa có giá bán
        const giaBan = parseFloat(m.GIATIEN || 0);

        // Màu cho Food Cost: lý tưởng dưới 35%
        const mauTyLe = tyLe == null ? 'text-gray-400'
                      : tyLe > 45 ? 'text-red-400' : (tyLe > 35 ? 'text-yellow-400' : 'text-emerald-400');

        const dongNL = ds.map((r, i) => {
            const urlAnh = r.URL_ANH_NHO || r.URL_ANH;
            const anh = (r.LOAI_ANH === 'anh_noi_bo' && urlAnh) ? ApiClient.TIEN_TO + urlAnh : (urlAnh || null);
            const daNgung = Boolean(r.DA_NGUNG);

            return `
                <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td class="py-2.5 text-center text-xs text-gray-500">${i + 1}</td>
                    <td class="py-2.5">
                        <div class="flex items-center gap-2">
                            ${anh ? `<img src="${Formatter.an(anh)}" class="w-7 h-7 rounded object-cover border border-white/10 shrink-0">`
                                  : `<div class="w-7 h-7 rounded bg-black/40 border border-white/10 grid place-items-center text-[10px] text-gray-400 shrink-0">NL</div>`}
                            <div>
                                <span class="font-medium text-sm block ${daNgung ? 'line-through text-gray-400' : 'text-white'}">
                                    ${Formatter.an(r.TENNL)}
                                </span>
                                ${daNgung ? `<span class="text-[10px] text-red-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-0.5"></i>Nguyên liệu đã ngừng</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="py-2.5 text-right font-mono font-bold text-gold-300">
                        ${this.soDep(r.SOLUONG)}
                    </td>
                    <td class="py-2.5 text-center text-xs text-gray-400 font-mono">
                        ${Formatter.an(r.DONVI)}
                    </td>
                    <td class="py-2.5 text-right text-xs text-gray-400">
                        ${Formatter.tien(r.GIA_NHAP_GANNHAT || 0)} ₫
                    </td>
                    <td class="py-2.5 text-right font-semibold text-sm text-gray-200">
                        ${Formatter.tien(r.GIA_VON_DONG || 0)} ₫
                    </td>
                    <td class="py-2.5 text-right whitespace-nowrap">
                        <button data-hanhdong="sua-dong-dl" data-manl="${r.MANL}" data-tennl="${Formatter.an(r.TENNL)}"
                                data-soluong="${r.SOLUONG}" data-donvi="${Formatter.an(r.DONVI)}"
                                class="p-1.5 text-gold-400 hover:text-gold-300 transition-colors" title="Sửa lượng">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button data-hanhdong="xoa-dong-dl" data-manl="${r.MANL}" data-tennl="${Formatter.an(r.TENNL)}"
                                class="p-1.5 text-red-400 hover:text-red-300 transition-colors ml-1" title="Xóa khỏi món">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        o.innerHTML = `
            <!-- Tiêu đề & Thông số tổng hợp món -->
            <div class="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-gold-400/20">
                <div class="flex items-center gap-3">
                    <img src="${Formatter.an(tuDs.HINHANH || 'https://placehold.co/100x100?text=Food')}"
                         class="w-14 h-14 rounded-lg object-cover border border-gold-400/30">
                    <div>
                        <h3 class="text-base font-bold text-white">${Formatter.an(m.TENMON)}</h3>
                        <div class="text-xs text-gray-400">
                            Giá bán: <span class="text-gold-400 font-bold">${Formatter.tien(giaBan)} ₫</span>
                            · Danh mục: ${Formatter.an(tuDs.TENLOAI || '')}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right px-3 py-1.5 bg-black/40 rounded-lg border border-white/5">
                        <div class="text-[10px] text-gray-400 uppercase tracking-wider">Giá vốn NVL</div>
                        <div class="text-sm font-bold text-gold-300">${Formatter.tien(giaVon)} ₫</div>
                    </div>
                    <div class="text-right px-3 py-1.5 bg-black/40 rounded-lg border border-white/5">
                        <div class="text-[10px] text-gray-400 uppercase tracking-wider">Food Cost %</div>
                        <div class="text-sm font-bold ${mauTyLe}">${tyLe == null ? '—' : tyLe + '%'}</div>
                    </div>
                    <button data-hanhdong="them-nl-vao-mon"
                            class="px-3.5 py-2 rounded-lg bg-gold-400 text-royal-900 text-xs font-bold hover:bg-gold-300 transition-all shadow-sm">
                        <i class="fa-solid fa-plus mr-1"></i>Thêm nguyên liệu
                    </button>
                </div>
            </div>

            <!-- Bảng chi tiết thành phần nguyên liệu -->
            <div class="mt-3 overflow-x-auto">
                ${ds.length ? `
                    <table class="w-full text-left text-xs">
                        <thead class="uppercase text-gray-400 border-b border-white/10 bg-black/10">
                            <tr>
                                <th class="py-2 px-1 text-center w-8">TT</th>
                                <th class="py-2">Nguyên liệu</th>
                                <th class="py-2 text-right">Lượng tiêu hao</th>
                                <th class="py-2 text-center">Đơn vị</th>
                                <th class="py-2 text-right">Giá nhập</th>
                                <th class="py-2 text-right">Chi phí</th>
                                <th class="py-2 text-right w-16"></th>
                            </tr>
                        </thead>
                        <tbody>${dongNL}</tbody>
                    </table>`
                : `<div class="py-12 text-center text-xs text-yellow-400/80 bg-yellow-500/5 rounded-lg border border-yellow-500/20 mt-2">
                       <i class="fa-solid fa-circle-exclamation text-xl mb-1.5 block"></i>
                       Món này chưa được cấu hình công thức định lượng.<br>
                       Khi bán ra sẽ không tự động trừ kho nguyên liệu!
                   </div>`}
            </div>`;
    }

    _ganSuKien() {
        // So theo phần tử, không theo cờ: KhoScreen vẽ lại #khoNoiDung mỗi
        // lần chuyển tab, nên cờ đã-gắn làm lần mở thứ hai không bấm được gì.
        if (!this.container || this.container === this._khungDaGan) return;
        this._khungDaGan = this.container;

        this.container.addEventListener('click', (e) => {
            const theMon = e.target.closest('.dl-the-mon');
            if (theMon) {
                const mamon = parseInt(theMon.dataset.mamon, 10);
                if (mamon && mamon !== this.mamonDangChon) {
                    this.napChiTiet(mamon);
                }
                return;
            }

            const nut = e.target.closest('[data-hanhdong]');
            if (!nut) return;

            const hd = nut.dataset.hanhdong;
            if (hd === 'them-nl-vao-mon') {
                this.moFormThemNguyenLieu();
            } else if (hd === 'sua-dong-dl') {
                this.moFormSuaDong(nut.dataset);
            } else if (hd === 'xoa-dong-dl') {
                this.xacNhanXoaDong(nut.dataset.manl, nut.dataset.tennl);
            }
        });

        this.container.addEventListener('input', (e) => {
            if (e.target.id === 'dlTimKiemMon') {
                clearTimeout(this._hoan);
                this._hoan = setTimeout(() => {
                    this.boLoc.tukhoa = e.target.value.trim();
                    this._veDanhSachMon();
                }, 250);
            }
        });

        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'dlLocChuaCo') {
                this.boLoc.chi_chua_co = e.target.checked;
                this._veDanhSachMon();
            }
        });
    }

    /** Mở popup thêm nguyên liệu vào món */
    async moFormThemNguyenLieu() {
        if (!this.mamonDangChon) return;
        try {
            const kq = await ApiClient.layDanhSach('kho_dinhluong.php', {
                action: 'nguyen_lieu',
                mamon: this.mamonDangChon
            });
            const dsNL = kq.danh_sach || [];

            if (!dsNL.length) {
                Dialog.canhBao('Đầy đủ', 'Món này đã bao gồm tất cả các nguyên liệu đang hoạt động.');
                return;
            }

            const optNL = dsNL.map(n =>
                `<option value="${n.MANL}" data-donvi="${Formatter.an(n.DONVI)}">
                    ${Formatter.an(n.TENNL)} (${Formatter.an(n.DONVI)})
                 </option>`).join('');

            const kqForm = await Swal.fire({
                title: 'Thêm nguyên liệu vào công thức',
                background: '#1a1f2c',
                color: '#fff',
                showCancelButton: true,
                confirmButtonText: 'Lưu vào công thức',
                cancelButtonText: 'Hủy',
                focusConfirm: false,
                html: `
                    <div class="text-left text-sm space-y-3">
                        <div>
                            <label class="block text-xs uppercase text-gray-400 mb-1">Chọn nguyên liệu</label>
                            <select id="fDlManl" class="w-full p-2.5 rounded-lg bg-black/30 border border-gold-400/20 text-sm text-white focus:outline-none focus:border-gold-400">
                                ${optNL}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs uppercase text-gray-400 mb-1">Số lượng tiêu hao / 1 phần món</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="fDlSoluong" step="0.001" min="0.001" placeholder="Ví dụ: 0.15"
                                       class="flex-1 p-2.5 rounded-lg bg-black/30 border border-gold-400/20 text-sm text-white focus:outline-none focus:border-gold-400">
                                <span id="fDlDonviHien" class="text-xs text-gold-300 font-mono px-2 py-1 bg-black/40 rounded border border-white/10">
                                    ${Formatter.an(dsNL[0].DONVI)}
                                </span>
                            </div>
                            <span class="text-[11px] text-gray-500 mt-1 block">Đơn vị nhỏ nhất: 0.001 (tương đương 1g hoặc 1ml)</span>
                        </div>
                    </div>`,
                didOpen: () => {
                    const sel = document.getElementById('fDlManl');
                    const lbl = document.getElementById('fDlDonviHien');
                    if (sel && lbl) {
                        sel.addEventListener('change', () => {
                            const opt = sel.options[sel.selectedIndex];
                            lbl.textContent = opt?.dataset?.donvi || '';
                        });
                    }
                },
                preConfirm: () => {
                    const manl = parseInt(document.getElementById('fDlManl')?.value, 10);
                    const soluong = parseFloat(document.getElementById('fDlSoluong')?.value);
                    if (!manl) {
                        Swal.showValidationMessage('Vui lòng chọn nguyên liệu');
                        return false;
                    }
                    if (!soluong || soluong <= 0) {
                        Swal.showValidationMessage('Số lượng định lượng phải lớn hơn 0');
                        return false;
                    }
                    return { manl, soluong };
                }
            });

            if (!kqForm.isConfirmed) return;

            await ApiClient.ghi('kho_dinhluong.php', {
                action: 'luu',
                mamon: this.mamonDangChon,
                manl: kqForm.value.manl,
                soluong: kqForm.value.soluong
            });

            Dialog.thanhCong('Đã lưu công thức');
            SocketBus.phatNhieu(['inventory_changed']);
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /** Sửa số lượng định lượng của dòng có sẵn */
    async moFormSuaDong(d) {
        const { manl, tennl, soluong, donvi } = d;
        const { value: slMoi } = await Swal.fire({
            title: `Sửa định lượng "${tennl}"`,
            input: 'number',
            inputValue: soluong,
            inputAttributes: { step: '0.001', min: '0.001' },
            text: `Số lượng mới cho 1 phần món (${donvi}):`,
            background: '#1a1f2c',
            color: '#fff',
            showCancelButton: true,
            confirmButtonText: 'Cập nhật',
            cancelButtonText: 'Hủy',
            inputValidator: (val) => {
                const x = parseFloat(val);
                if (!x || x <= 0) return 'Số lượng phải lớn hơn 0';
            }
        });

        if (!slMoi) return;

        try {
            await ApiClient.ghi('kho_dinhluong.php', {
                action: 'luu',
                mamon: this.mamonDangChon,
                manl,
                soluong: slMoi
            });
            Dialog.thanhCong('Đã cập nhật định lượng');
            SocketBus.phatNhieu(['inventory_changed']);
            await this.napChiTiet(this.mamonDangChon);
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    /** Xóa một dòng nguyên liệu khỏi món */
    async xacNhanXoaDong(manl, tennl) {
        const ds = this.chiTiet?.danh_sach || [];
        const laDongCuoi = ds.length <= 1;

        const canhBao = laDongCuoi
            ? `Đây là nguyên liệu CUỐI CÙNG của món. Nếu xóa, món sẽ trở thành món CHƯA CÓ CÔNG THỨC và đơn bán sau này sẽ không trừ kho nguyên liệu nào!`
            : `Nguyên liệu "${tennl}" sẽ bị loại khỏi công thức của món này. Các lần trừ kho tiếp theo sẽ không trừ nguyên liệu này nữa.`;

        const dongY = await Dialog.xacNhanXoa(`Xóa "${tennl}"?`, canhBao);
        if (!dongY) return;

        try {
            const res = await ApiClient.ghi('kho_dinhluong.php', {
                action: 'xoa',
                mamon: this.mamonDangChon,
                manl
            });

            if (res.mon_trong) {
                await Dialog.canhBao('Đã xóa dòng cuối', 'Món này hiện không còn nguyên liệu nào trong công thức định lượng!');
            } else {
                Dialog.thanhCong('Đã xóa khỏi công thức');
            }

            SocketBus.phatNhieu(['inventory_changed']);
            await this.nap();
        } catch (e) {
            Dialog.loiApi(e);
        }
    }

    soDep(n) {
        const x = parseFloat(n || 0);
        return x.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
    }
}
