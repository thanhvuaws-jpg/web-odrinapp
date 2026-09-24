import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';
import { HieuUngRoi } from '../core/HieuUngRoi.js';
import { DuBaoPanel } from './DuBaoPanel.js';
import { NguyenLieuScreen } from './NguyenLieuScreen.js';
import { DinhLuongScreen }  from './DinhLuongScreen.js';
import { HanSuDungPanel }   from './HanSuDungPanel.js';

/**
 * KhoScreen — màn hình kho nguyên vật liệu cho trang quản trị.
 *
 *
 * VÌ SAO KHÔNG KẾ THỪA CrudScreen
 * ================================
 * CrudScreen dựng một bảng với nút thêm/sửa/xóa cho MỘT loại bản ghi. Màn
 * này có bốn thẻ con (tồn kho, nhập, xuất, hủy), và thứ người dùng tạo ra
 * là một PHIẾU gồm nhiều dòng hàng — không phải một hàng trong bảng.
 *
 * Ép vào CrudScreen sẽ phải ghi đè gần hết, tức kế thừa chỉ để lấy vài
 * dòng tiện ích. Cùng lý do ChatScreen đứng riêng.
 *
 *
 * ẢNH
 * ===
 * Máy chủ trả `LOAI_ANH` một trong ba: `anh_noi_bo` (ảnh chụp trong thư
 * mục images/ của API), `anh_ngoai` (URL tuyệt đối, ví dụ Cloudinary),
 * hoặc `khong_co`.
 *
 * Màn này KHÔNG tự đoán kiểu ảnh từ chuỗi. Máy chủ đã phân loại sẵn vì có
 * hai giao diện (web và app) — để mỗi bên tự đoán thì sớm muộn một bên xử
 * lý thiếu một dạng và hiện ô trống mà không báo lỗi gì.
 *
 *
 * IN PHIẾU: FETCH RỒI ĐỔ VÀO CỬA SỔ MỚI
 * ======================================
 * Không dùng `window.open('in_phieu_kho.php?...&token=...')`. Token nằm
 * trong đường dẫn sẽ bị ghi nguyên văn vào access log của Apache — đúng
 * lý do dự án đã bỏ cách truyền token qua tham số.
 */
export class KhoScreen {

    /** Hỏi lượt trừ kho mới mỗi bao lâu khi tab đang mở. */
    static CHU_KY_MS = 2500;

    constructor() {
        this.tabCon      = 'ton';     // ton | nhap | xuat | huy | nguyenlieu | dinhluong | hansudung | dubao
        this.nguyenLieu  = [];
        this.nhom        = [];
        this.thongKe     = null;
        this.boLoc       = { manhom: '', tukhoa: '', chi_canh_bao: false };
        this.dongPhieu   = [];        // dòng hàng của phiếu đang soạn
        this._daGan      = false;
        this._mocSoKho   = 0;         // MASO lớn nhất đã thấy
        this._henHoi     = null;
        this._dangHoi    = false;
        this.duBao       = new DuBaoPanel(this);
        this.manHinhNL   = new NguyenLieuScreen();
        this.manHinhDL   = new DinhLuongScreen(this);
        this.panelHSD    = new HanSuDungPanel(this);
    }

    /* ══════════════════════════ Vòng đời ══════════════════════════ */

    async khoiDong() {
        this._veKhung();
        this._ganSuKien();
        await this.nap();
        this.batDauTheoDoi();
    }

    /* ══════════════════ Theo dõi lượt trừ kho mới ══════════════════
     *
     * Hỏi lại định kỳ chứ không dùng socket: lượt trừ kho sinh ra trong
     * `checkout_order.php`, một tệp PHP không nói chuyện được với máy chủ
     * socket. Thêm đường báo socket từ PHP là thêm một mắt xích có thể đứt
     * lặng lẽ, trong khi một câu SELECT theo MASO mỗi 2,5 giây thì rẻ và
     * không bao giờ bỏ sót.
     *
     * Chỉ chạy khi tab kho đang mở — cùng lý do với hộp thư chăm sóc khách
     * hàng: trang quản trị mở suốt ca sẽ gọi mạng hàng nghìn lần cho một
     * tab không ai nhìn.
     */
    async batDauTheoDoi() {
        this.tamDung();
        try {
            // Lần đầu chỉ lấy mốc. Không vậy thì mở tab ra là cả trăm lượt
            // trừ kho trong quá khứ đổ xuống màn hình cùng lúc.
            const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php',
                                                   { action: 'bien_dong_moi', tu_maso: 0 });
            this._mocSoKho = kq.moc || 0;
        } catch (e) { /* hỏi lại ở nhịp sau */ }
        this._henHoi = setInterval(() => this._hoiBienDong(), KhoScreen.CHU_KY_MS);
    }

    tamDung() {
        if (this._henHoi) clearInterval(this._henHoi);
        this._henHoi = null;
    }

    async _hoiBienDong() {
        // Mạng chậm thì lượt hỏi trước chưa xong lượt sau đã tới — hai lượt
        // cùng mang một mốc sẽ trả về cùng một lượt trừ kho, và ảnh rơi hai lần.
        if (this._dangHoi || !this._mocSoKho) return;
        this._dangHoi = true;
        try {
            const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php',
                                   { action: 'bien_dong_moi', tu_maso: this._mocSoKho });
            if (kq.danh_sach && kq.danh_sach.length) this._apDungBienDong(kq.danh_sach);
            this._mocSoKho = Math.max(this._mocSoKho, kq.moc || 0);
        } catch (e) {
            // Im lặng: đây là phần trang trí thời gian thực. Mạng chớp một
            // nhịp thì nhịp sau hỏi bù — mốc chưa tăng nên không mất lượt nào.
        } finally {
            this._dangHoi = false;
        }
    }

    /**
     * Áp một loạt lượt trừ kho lên màn hình: ảnh rơi, thẻ rung, số đếm lùi.
     *
     * Cập nhật TẠI CHỖ từng thẻ, không vẽ lại cả danh sách: vẽ lại thì mất
     * vị trí xuất phát của ảnh rơi và mất luôn hiệu ứng rung, trong khi chỉ
     * vài thẻ thực sự thay đổi.
     */
    _apDungBienDong(ds) {
        // Gộp theo nguyên liệu: một đơn 2 tô phở + 1 bún bò trừ xương ống hai
        // lần, gộp lại thì rơi một lượt cho gọn thay vì hai lượt dồn nhau.
        const theoNL  = new Map();
        const theoDon = new Map();
        for (const r of ds) {
            const cu = theoNL.get(r.MANL);
            if (cu) {
                cu.THAYDOI = +cu.THAYDOI + +r.THAYDOI;
                cu.TON_SAU = r.TON_SAU;
                cu.TINHTRANG_TON = r.TINHTRANG_TON;
            } else {
                theoNL.set(r.MANL, { ...r });
            }
            if (r.LOAI_PHIEU === 'DONDAT') {
                if (!theoDon.has(r.MAPHIEU)) theoDon.set(r.MAPHIEU, new Set());
                theoDon.get(r.MAPHIEU).add(r.TENNL);
            }
        }

        let i = 0;
        for (const r of theoNL.values()) {
            // So le giữa các nguyên liệu: tất cả rơi cùng một khoảnh khắc thì
            // mắt không kịp thấy từng thứ là gì.
            setTimeout(() => this._roiMotNguyenLieu(r), i++ * 140);
        }

        for (const [maDon, tenNL] of theoDon) {
            const ten = [...tenNL];
            HieuUngRoi.thongBao(
                `<b>Đơn #${maDon}</b> vừa bán — trừ ${ten.length} nguyên liệu` +
                `<div class="phu">${ten.slice(0, 5).map(t => Formatter.an(t)).join(' · ')}` +
                `${ten.length > 5 ? ' …' : ''}</div>`);
        }

        // Thẻ tóm tắt đếm theo toàn kho, không suy ra được từ vài dòng vừa
        // nhận — hỏi lại một lần, sau khi ảnh đã rơi xong.
        clearTimeout(this._henTomTat);
        this._henTomTat = setTimeout(() => this._napLaiTomTat(), 1800);
    }

    _roiMotNguyenLieu(r) {
        const url = r.LOAI_ANH === 'anh_ngoai'  ? r.URL_ANH
                  : r.LOAI_ANH === 'anh_noi_bo' ? ApiClient.TIEN_TO + r.URL_ANH
                  : null;
        const luong = Math.abs(+r.THAYDOI);

        // Số hạt theo lượng trừ, không cố định: trừ 12 quả trứng mà chỉ rơi
        // một hạt thì không ai thấy khác gì trừ một nhúm quế.
        const demDuoc = ['quả', 'cái', 'gói', 'lon', 'chai', 'hộp', 'bó'].includes(r.DONVI);
        const soHat = demDuoc
            ? Math.min(5, Math.max(2, Math.round(luong)))
            : 2 + (luong >= 0.1 ? 1 : 0) + (luong >= 0.4 ? 1 : 0) + (luong >= 1 ? 1 : 0);

        const the = document.querySelector(`#tab-kho-content .kho-the[data-manl="${r.MANL}"]`);
        if (the) {
            const oAnh = the.querySelector('.kho-anh');
            HieuUngRoi.roi(url, this.chuDau(r.TENNL), (oAnh || the).getBoundingClientRect(), soHat);
            HieuUngRoi.rungThe(the);

            const oSo = the.querySelector('.kho-so');
            const truoc = parseFloat((oSo?.textContent || '0').replace(',', '.')) || 0;
            HieuUngRoi.demLui(oSo, truoc, parseFloat(r.TON_SAU), v => this.soDep(v));

            const pill = the.querySelector('.kho-pill');
            if (pill) {
                const k = this._kieuTon(r.TINHTRANG_TON);
                pill.className = 'kho-pill inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 ' +
                                 'rounded-full border ' + k.lop;
                pill.textContent = k.nhan;
            }
        } else {
            // Nguyên liệu đang bị bộ lọc ẩn, hoặc đang ở thẻ con khác: vẫn
            // cho rơi, từ mép trên vùng nội dung. Lượt trừ kho vẫn xảy ra
            // thật — giấu đi thì người đứng xem không biết kho vừa động.
            const vung = document.getElementById('khoNoiDung')?.getBoundingClientRect();
            if (vung) {
                const o = { left: vung.left + Math.random() * vung.width * 0.8,
                            top: vung.top, width: 60, height: 60 };
                HieuUngRoi.roi(url, this.chuDau(r.TENNL), o, soHat);
            }
        }

        const nl = this.nguyenLieu.find(n => +n.MANL === +r.MANL);
        if (nl) { nl.TON_HIENTAI = r.TON_SAU; nl.TINHTRANG_TON = r.TINHTRANG_TON; }
    }

    async _napLaiTomTat() {
        if (this.tabCon !== 'ton') return;
        try {
            const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php');
            this.thongKe = { dem: kq.dem, gia_tri_ton: kq.gia_tri_ton, so: kq.so_nguyen_lieu,
                             canh_bao_han: kq.canh_bao_han };
            this._veTheTomTat();
        } catch (e) { /* bỏ qua */ }
    }


    async nap() {
        if (this.tabCon === 'ton') {
            const [kq, nhom] = await Promise.all([
                ApiClient.layDanhSach('kho_nguyenlieu.php', {
                    manhom: this.boLoc.manhom || '',
                    tukhoa: this.boLoc.tukhoa || '',
                    chi_canh_bao: this.boLoc.chi_canh_bao ? '1' : ''
                }),
                this.nhom.length ? Promise.resolve(null)
                                 : ApiClient.layDanhSach('kho_nguyenlieu.php', { action: 'nhom' })
            ]);
            if (nhom) this.nhom = nhom.danh_sach || [];
            this.nguyenLieu = kq.danh_sach || [];
            this.thongKe    = { dem: kq.dem, gia_tri_ton: kq.gia_tri_ton, so: kq.so_nguyen_lieu,
                             canh_bao_han: kq.canh_bao_han };
            this._veTonKho();
        } else if (this.tabCon === 'dubao') {
            await this.duBao.nap();
        } else if (this.tabCon === 'nguyenlieu') {
            this._veKhungNguyenLieu();
            await this.manHinhNL.napNhom();
            await this.manHinhNL.khoiDong();
        } else if (this.tabCon === 'dinhluong') {
            const thanh = document.getElementById('khoThanh');
            if (thanh) thanh.innerHTML = '';
            await this.manHinhDL.khoiDong(document.getElementById('khoNoiDung'));
        } else if (this.tabCon === 'hansudung') {
            const thanh = document.getElementById('khoThanh');
            if (thanh) thanh.innerHTML = '';
            await this.panelHSD.khoiDong(document.getElementById('khoNoiDung'));
        } else {
            const kq = await ApiClient.layDanhSach('kho_phieu.php', { loai: this.tabCon });
            this._vePhieu(kq);
        }
    }

    /* ══════════════════════════ Khung ══════════════════════════ */

    _veKhung() {
        const o = document.getElementById('tab-kho-content');
        if (!o) return;

        const tab = (ma, nhan, icon) => `
            <button data-tabkho="${ma}"
                class="tab-kho px-5 py-2.5 text-sm font-bold border-b-2 transition-all
                       focus:outline-none whitespace-nowrap
                       ${this.tabCon === ma
                          ? 'border-gold-400 text-gold-400'
                          : 'border-transparent text-gray-400 hover:text-white'}">
                <i class="fa-solid ${icon} mr-1.5"></i>${nhan}</button>`;

        o.innerHTML = `
          <div class="space-y-6">
            <div id="khoTheTomTat" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3"></div>

            <div class="border-b border-gold-400/10 flex gap-1 overflow-x-auto">
              ${tab('ton','Tồn kho','fa-boxes-stacked')}
              ${tab('nhap','Nhập hàng','fa-truck-ramp-box')}
              ${tab('xuat','Xuất kho','fa-utensils')}
              ${tab('huy','Hủy hàng','fa-trash-can')}
              ${tab('nguyenlieu','Nguyên liệu','fa-cubes')}
              ${tab('dinhluong','Định lượng','fa-mortar-pestle')}
              ${tab('hansudung','Cảnh báo hạn','fa-calendar-xmark')}
              ${tab('dubao','Dự báo đặt hàng','fa-chart-line')}
            </div>

            <div id="khoThanh" class="flex flex-wrap gap-3 items-center"></div>
            <div id="khoNoiDung"></div>
          </div>`;
    }

    _ganSuKien() {
        if (this._daGan) return;
        this._daGan = true;

        const o = document.getElementById('tab-kho-content');
        if (!o) return;

        // Một trình xử lý cho cả màn hình thay vì gắn vào từng nút: nội
        // dung được vẽ lại liên tục, gắn từng nút thì mỗi lần vẽ lại phải
        // gắn lại, và quên một chỗ là nút đó chết im lặng.
        o.addEventListener('click', (e) => {
            const nut = e.target.closest('[data-tabkho], [data-hanhdong]');
            if (!nut) return;

            if (nut.dataset.tabkho) {
                this.tabCon = nut.dataset.tabkho;
                this._veKhung();
                this.nap().catch(err => Dialog.loiApi(err));
                return;
            }
            this._xuLy(nut.dataset.hanhdong, nut.dataset).catch(err => Dialog.loiApi(err));
        });

        o.addEventListener('input', (e) => {
            if (e.target.dataset.dubaoManl) {
                this.duBao.suaSoLuong(parseInt(e.target.dataset.dubaoManl, 10), e.target.value);
                return;
            }
            if (e.target.id === 'khoTimKiem') {
                clearTimeout(this._hoan);
                this._hoan = setTimeout(() => {
                    this.boLoc.tukhoa = e.target.value.trim();
                    this.nap().catch(err => Dialog.loiApi(err));
                }, 300);
            }
        });

        o.addEventListener('change', (e) => {
            if (e.target.dataset.hanhdong === 'dubao-chon-ngay' && e.target.value) {
                this.duBao.nap(e.target.value).catch(err => Dialog.loiApi(err));
                return;
            }
            if (e.target.id === 'khoLocNhom') {
                this.boLoc.manhom = e.target.value;
                this.nap().catch(err => Dialog.loiApi(err));
            }
            if (e.target.id === 'khoChiCanhBao') {
                this.boLoc.chi_canh_bao = e.target.checked;
                this.nap().catch(err => Dialog.loiApi(err));
            }
        });
    }

    async _xuLy(hanhDong, d) {
        switch (hanhDong) {
            case 'tao-phieu':  return this._moFormPhieu(d.loai);
            case 'in-phieu':   return this.inPhieu(d.loai, parseInt(d.ma, 10));
            case 'xem-phieu':  return this.xemPhieu(d.loai, parseInt(d.ma, 10));
            case 'lich-su':    return this.xemLichSu(parseInt(d.manl, 10));
            case 'kiem-ke':    return this.moKiemKe();
            case 'doi-chieu':  return this.doiChieu();
            case 'dubao-ngay': return this.duBao.nap(d.ngay);
            case 'dubao-chot': return this.duBao.chot();
            case 'nl-them':    return this.manHinhNL.moFormThem();
            case 'nl-che-do': {
                // Vẽ khung TRƯỚC rồi mới nạp. Bản đầu nạp trước rồi vẽ khung,
                // nên khung mới đè mất bảng vừa vẽ và người dùng thấy trống.
                this.manHinhNL.xemDaNgung = d.ngung === '1';
                this._veKhungNguyenLieu();
                await this.manHinhNL.khoiDong();
                return;
            }
            case 'mo-tab-hansudung': {
                this.tabCon = 'hansudung';
                this._veKhung();
                return this.nap();
            }
        }
    }

    _veKhungNguyenLieu() {
        const thanh = document.getElementById('khoThanh');
        if (thanh) thanh.innerHTML = `
            <div class="flex items-center gap-2">
                <button data-hanhdong="nl-che-do" data-ngung="0"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!this.manHinhNL.xemDaNgung ? 'bg-gold-400 text-royal-900 shadow-sm' : 'bg-black/30 border border-white/10 text-gray-400 hover:text-white'}">
                    <i class="fa-solid fa-boxes-stacked mr-1"></i>Đang sử dụng
                </button>
                <button data-hanhdong="nl-che-do" data-ngung="1"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${this.manHinhNL.xemDaNgung ? 'bg-gold-400 text-royal-900 shadow-sm' : 'bg-black/30 border border-white/10 text-gray-400 hover:text-white'}">
                    <i class="fa-solid fa-ban mr-1"></i>Đã ngừng sử dụng
                </button>
            </div>
            <button data-hanhdong="nl-them"
                    class="ml-auto px-4 py-2 rounded-lg bg-gold-400 text-royal-900 text-sm font-bold hover:bg-gold-300 transition-all shadow-sm">
                <i class="fa-solid fa-plus mr-1.5"></i>Thêm nguyên liệu
            </button>`;

        const noi = document.getElementById('khoNoiDung');
        if (noi) noi.innerHTML = `<div id="khoNguyenLieuNoiDung"></div>`;
    }

    /* ══════════════════════════ Tồn kho ══════════════════════════ */

    _veTonKho() {
        this._veTheTomTat();

        const thanh = document.getElementById('khoThanh');
        if (thanh) thanh.innerHTML = `
            <input id="khoTimKiem" type="text" placeholder="Tìm nguyên liệu…"
                   value="${Formatter.an(this.boLoc.tukhoa)}"
                   class="px-4 py-2 rounded-lg bg-black/20 border border-gold-400/20
                          text-sm focus:outline-none focus:border-gold-400 w-56">
            <select id="khoLocNhom"
                   class="px-4 py-2 rounded-lg bg-black/20 border border-gold-400/20
                          text-sm focus:outline-none focus:border-gold-400">
              <option value="">Tất cả nhóm</option>
              ${this.nhom.map(g => `<option value="${g.MANHOM}"
                 ${String(this.boLoc.manhom) === String(g.MANHOM) ? 'selected' : ''}>
                 ${Formatter.an(g.TENNHOM)} (${g.SO_NL})</option>`).join('')}
            </select>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input id="khoChiCanhBao" type="checkbox" ${this.boLoc.chi_canh_bao ? 'checked' : ''}
                     class="accent-gold-400"> Chỉ thứ cần chú ý
            </label>
            <div class="ml-auto flex gap-2">
              <button data-hanhdong="kiem-ke"
                class="px-4 py-2 rounded-lg bg-gold-400 text-royal-900 text-sm font-bold
                       hover:bg-gold-300 transition-all">
                <i class="fa-solid fa-clipboard-check mr-1.5"></i>Kiểm kê</button>
              <button data-hanhdong="doi-chieu"
                class="px-4 py-2 rounded-lg border border-gold-400/30 text-gold-400 text-sm
                       font-bold hover:bg-gold-400/10 transition-all">
                <i class="fa-solid fa-scale-balanced mr-1.5"></i>Đối chiếu sổ</button>
            </div>`;

        const noi = document.getElementById('khoNoiDung');
        if (!noi) return;

        if (!this.nguyenLieu.length) {
            noi.innerHTML = this._trong('Không có nguyên liệu nào khớp bộ lọc.');
            return;
        }

        noi.innerHTML = `<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
            ${this.nguyenLieu.map(n => this._dongNguyenLieu(n)).join('')}</div>`;
    }

    _veTheTomTat() {
        const o = document.getElementById('khoTheTomTat');
        if (!o || !this.thongKe) return;

        const d = this.thongKe.dem || {};
        const the = (nhan, so, mau, icon) => `
            <div class="bg-black/20 border border-gold-400/10 rounded-xl p-4">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400 uppercase tracking-wider">${nhan}</span>
                <i class="fa-solid ${icon} ${mau}"></i>
              </div>
              <div class="text-2xl font-bold mt-1 ${mau}">${so}</div>
            </div>`;

        // Tên khóa theo kho_dem_canh_bao_han(): het_han / sap_het_han. Bản
        // đầu đọc so_het_han / so_sap_het (tên của hàm chi tiết, và sai cả
        // tên đó), nên thẻ luôn hiện 0 kể cả khi có lô đã hết hạn.
        const cb = this.thongKe.canh_bao_han || {};
        const cbHet = cb.het_han || 0;
        const cbSap = cb.sap_het_han || 0;
        const coCanhBao = cbHet > 0 || cbSap > 0;

        o.innerHTML =
            // 'Âm' đứng riêng chứ không gộp vào 'hết'. Hai cái trông giống
            // nhau nhưng nghĩa khác hẳn: hết thì đặt thêm là xong, âm là sổ
            // sách sai và đặt thêm không sửa được.
            the('Tồn âm — sổ sai', d.am || 0, 'text-red-400', 'fa-triangle-exclamation') +
            the('Đã hết', d.het || 0, 'text-orange-400', 'fa-circle-xmark') +
            the('Sắp hết', d.sap_het || 0, 'text-yellow-400', 'fa-circle-exclamation') +
            `<div data-hanhdong="mo-tab-hansudung"
                  class="cursor-pointer bg-black/20 border border-gold-400/10 rounded-xl p-4 hover:border-gold-400/30 transition-all"
                  title="Nhấn để xem chi tiết lô hàng cận/hết hạn">
               <div class="flex items-center justify-between">
                 <span class="text-xs text-gray-400 uppercase tracking-wider">Cảnh báo hạn</span>
                 <i class="fa-solid fa-calendar-xmark ${coCanhBao ? 'text-red-400 animate-pulse' : 'text-gray-500'}"></i>
               </div>
               <div class="text-2xl font-bold mt-1 ${cbHet > 0 ? 'text-red-400' : (cbSap > 0 ? 'text-yellow-400' : 'text-gray-400')}">
                 ${cbHet > 0 ? `${cbHet} hết hạn` : (cbSap > 0 ? `${cbSap} cận hạn` : '0')}
               </div>
               <div class="text-[10px] text-gray-500 mt-1">Trong vòng 7 ngày</div>
             </div>` +
            `<div class="bg-black/20 border border-gold-400/10 rounded-xl p-4">
               <div class="flex items-center justify-between">
                 <span class="text-xs text-gray-400 uppercase tracking-wider">Giá trị tồn</span>
                 <i class="fa-solid fa-coins text-gold-400"></i>
               </div>
               <div class="text-2xl font-bold mt-1 text-gold-400">
                 ${Formatter.tien(this.thongKe.gia_tri_ton)}<span class="text-sm"> ₫</span></div>
             </div>`;
    }

    /**
     * Nhãn và lớp màu cho tình trạng tồn.
     *
     * Tên lớp Tailwind phải là chuỗi ĐẦY ĐỦ, không ghép động. Tailwind quét
     * mã nguồn để sinh CSS nên `text-${x}-400` không bao giờ được tạo ra —
     * dự án đã vấp lỗi này bốn lần (QĐ-024, 071, 074, 081).
     */
    _kieuTon(tt) {
        return {
            am:      { nhan: 'Tồn âm',  lop: 'bg-red-500/15 text-red-400 border-red-500/30' },
            het:     { nhan: 'Hết',     lop: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
            sap_het: { nhan: 'Sắp hết', lop: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
            du:      { nhan: 'Đủ',      lop: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
        }[tt] || { nhan: '—', lop: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
    }

    _dongNguyenLieu(n) {
        const kieu = this._kieuTon(n.TINHTRANG_TON);

        // data-manl + các lớp kho-anh / kho-so / kho-pill: để khi có lượt
        // trừ kho mới, hiệu ứng tìm đúng thẻ mà rung, đếm lùi số, và cho ảnh
        // rơi ra từ đúng chỗ — không phải vẽ lại cả danh sách.
        return `
          <div data-manl="${n.MANL}"
               class="kho-the flex items-center gap-3 bg-black/20 border border-gold-400/10
                      rounded-xl px-4 py-3 hover:border-gold-400/30 transition-all">
            <div class="kho-anh w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-black/30 grid place-items-center">
              ${this.anhNguyenLieu(n)}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold truncate">${Formatter.an(n.TENNL)}</div>
              <div class="text-xs text-gray-400 truncate">
                ${Formatter.an(n.TENNHOM || '')} · tối thiểu
                ${this.soDep(n.TON_TOITHIEU)} ${Formatter.an(n.DONVI)}
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="font-bold ${n.TINHTRANG_TON === 'am' ? 'text-red-400' : ''}">
                <span class="kho-so">${this.soDep(n.TON_HIENTAI)}</span>
                <span class="text-xs text-gray-400">${Formatter.an(n.DONVI)}</span>
              </div>
              <span class="kho-pill inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5
                           rounded-full border ${kieu.lop}">${kieu.nhan}</span>
            </div>
            <button data-hanhdong="lich-su" data-manl="${n.MANL}"
              class="shrink-0 w-9 h-9 rounded-lg border border-gold-400/20 text-gold-400
                     hover:bg-gold-400/10 transition-all" title="Lịch sử biến động">
              <i class="fa-solid fa-clock-rotate-left text-xs"></i></button>
          </div>`;
    }

    /**
     * Ảnh nguyên liệu.
     *
     * Đường dẫn ảnh nội bộ lưu TƯƠNG ĐỐI trong CSDL ('images/…'), client
     * tự ghép tiền tố API của mình. Máy chủ không ghép được vì Apache cắt
     * bỏ '/api/' trước khi chuyển tiếp nên PHP không còn thấy tiền tố đó.
     *
     * CHƯA CÓ ẢNH THÌ HIỆN CHỮ CÁI ĐẦU, KHÔNG HIỆN HÌNH VẼ
     * -----------------------------------------------------
     * Bản đầu dùng một bộ biểu tượng vector tự vẽ cho những mặt hàng chưa
     * có ảnh. Nhìn trên màn hình thật thì hỏng: hình vẽ đặt cạnh ảnh chụp
     * studio trông như hình minh họa lạc vào album ảnh. Đã bỏ (xem sql/28).
     *
     * Ô chữ cái là một CHỖ TRỐNG CÓ NHÃN — nó không giả vờ là ảnh, nên
     * không lệch tông, và nhìn lướt là biết ngay mặt hàng nào còn thiếu ảnh.
     */
    anhNguyenLieu(n) {
        const url = n.LOAI_ANH === 'anh_ngoai' ? n.URL_ANH
                  : n.LOAI_ANH === 'anh_noi_bo' ? ApiClient.TIEN_TO + n.URL_ANH
                  : null;

        if (url) {
            return `<img src="${Formatter.an(url)}" alt=""
                         class="w-full h-full object-cover" loading="lazy">`;
        }
        return `<span class="text-base font-bold text-gray-500 select-none"
                      title="Chưa có ảnh">${Formatter.an(this.chuDau(n.TENNL))}</span>`;
    }

    /** "Xương ống heo" -> "XH" · "Muối" -> "M" */
    chuDau(ten) {
        const tu = String(ten || '?').trim().split(/\s+/);
        if (tu.length === 1) return tu[0].charAt(0).toUpperCase();
        return (tu[0].charAt(0) + tu[tu.length - 1].charAt(0)).toUpperCase();
    }

    /* ══════════════════════════ Phiếu ══════════════════════════ */

    _vePhieu(kq) {
        const loai  = this.tabCon;
        const ten   = { nhap: 'phiếu nhập', xuat: 'phiếu xuất', huy: 'biên bản hủy' }[loai];
        const coTien = loai !== 'xuat';

        const thanh = document.getElementById('khoThanh');
        if (thanh) thanh.innerHTML = `
            <div class="text-sm text-gray-400">
              ${kq.so_phieu} ${ten} · từ ${Formatter.ngay(kq.tu_ngay)} đến ${Formatter.ngay(kq.den_ngay)}
              ${coTien ? ` · tổng <span class="text-gold-400 font-bold">
                           ${Formatter.tien(kq.tong_tien)} ₫</span>` : ''}
            </div>
            <button data-hanhdong="tao-phieu" data-loai="${loai}"
              class="ml-auto px-4 py-2 rounded-lg bg-gold-400 text-royal-900 text-sm font-bold
                     hover:bg-gold-300 transition-all">
              <i class="fa-solid fa-plus mr-1.5"></i>Lập ${ten}</button>`;

        const noi = document.getElementById('khoNoiDung');
        if (!noi) return;

        if (!kq.danh_sach.length) {
            noi.innerHTML = this._trong(`Chưa có ${ten} nào trong 30 ngày qua.`);
            return;
        }

        const khoa = { nhap: 'MAPHIEUNHAP', xuat: 'MAPHIEUXUAT', huy: 'MAPHIEUHUY' }[loai];
        const ngay = { nhap: 'NGAYNHAP', xuat: 'NGAYXUAT', huy: 'NGAYHUY' }[loai];

        noi.innerHTML = `<div class="space-y-2">${kq.danh_sach.map(p => `
            <div class="flex items-center gap-4 bg-black/20 border border-gold-400/10
                        rounded-xl px-4 py-3 hover:border-gold-400/30 transition-all">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-gold-400">${Formatter.an(p.SO_PHIEU)}</div>
                <div class="text-xs text-gray-400 truncate">
                  ${Formatter.ngay(p[ngay])} ${Formatter.gioPhut(p[ngay])}
                  · ${p.SO_DONG} mặt hàng
                  ${p.NHACUNGCAP ? ' · ' + Formatter.an(p.NHACUNGCAP) : ''}
                  ${p.NGUOI_NHAN ? ' · ' + Formatter.an(p.NGUOI_NHAN) : ''}
                  ${p.LYDO ? ' · ' + Formatter.an(this.tenLyDo(p.LYDO)) : ''}
                  ${p.NGUOI_LAP ? ' · ' + Formatter.an(p.NGUOI_LAP) : ''}
                </div>
              </div>
              ${coTien ? `<div class="text-right shrink-0 font-bold
                  ${loai === 'huy' ? 'text-red-400' : 'text-gold-400'}">
                  ${Formatter.tien(p.TONGTIEN ?? p.GIATRI_THIETHAI ?? 0)} ₫</div>` : ''}
              <button data-hanhdong="xem-phieu" data-loai="${loai}" data-ma="${p[khoa]}"
                class="shrink-0 w-9 h-9 rounded-lg border border-gold-400/20 text-gold-400
                       hover:bg-gold-400/10" title="Xem chi tiết">
                <i class="fa-solid fa-eye text-xs"></i></button>
              <button data-hanhdong="in-phieu" data-loai="${loai}" data-ma="${p[khoa]}"
                class="shrink-0 w-9 h-9 rounded-lg border border-gold-400/20 text-gold-400
                       hover:bg-gold-400/10" title="In phiếu">
                <i class="fa-solid fa-print text-xs"></i></button>
            </div>`).join('')}</div>`;
    }

    tenLyDo(ma) {
        return {
            bep: 'Xuất cho bếp', sukien: 'Tiệc/sự kiện', khac: 'Khác',
            hethan: 'Hết hạn', hong: 'Hư hỏng', vosinh: 'Không đảm bảo vệ sinh',
            roivo: 'Rơi vỡ'
        }[ma] || ma;
    }

    /* ══════════════════════════ In phiếu ══════════════════════════ */

    async inPhieu(loai, ma) {
        try {
            // fetch kèm header thay vì window.open có token trong URL —
            // xem ghi chú ở đầu lớp và trong api/in_phieu_kho.php.
            const r = await fetch(
                `${ApiClient.TIEN_TO}api/in_phieu_kho.php?loai=${loai}&maphieu=${ma}`,
                { headers: this._header() }
            );
            if (!r.ok) throw new Error('Máy chủ trả mã ' + r.status);

            const cua = window.open('', '_blank');
            if (!cua) {
                Dialog.canhBao('Trình duyệt chặn cửa sổ mới',
                    'Hãy cho phép cửa sổ bật lên ở trang này rồi bấm In lại.');
                return;
            }
            cua.document.write(await r.text());
            cua.document.close();
        } catch (e) {
            Dialog.loi('Không mở được phiếu in', e.message || 'Vui lòng thử lại.');
        }
    }

    _header() {
        const h = {};
        try {
            const manv  = localStorage.getItem('manv');
            const token = localStorage.getItem('token');
            if (manv && token) { h['X-Manv'] = manv; h['X-Token'] = token; }
        } catch (e) { /* trình duyệt chặn localStorage */ }
        return h;
    }

    /* ══════════════════════ Xem chi tiết phiếu ══════════════════════ */

    async xemPhieu(loai, ma) {
        const kq = await ApiClient.layDanhSach('kho_phieu.php', { loai, maphieu: ma });
        const p  = kq.phieu;
        const coTien = loai !== 'xuat';

        const dong = (p.CHI_TIET || []).map((c, i) => `
            <tr class="border-b border-white/5">
              <td class="py-1.5 text-center text-gray-500">${i + 1}</td>
              <td class="py-1.5">${Formatter.an(c.TENNL)}</td>
              <td class="py-1.5 text-right">${this.soDep(c.SOLUONG)}
                  <span class="text-gray-500">${Formatter.an(c.DONVI)}</span></td>
              ${coTien ? `<td class="py-1.5 text-right">${Formatter.tien(c.DONGIA || 0)}</td>
                          <td class="py-1.5 text-right font-semibold">
                            ${Formatter.tien(Math.round((c.SOLUONG || 0) * (c.DONGIA || 0)))}</td>` : ''}
            </tr>`).join('');

        const urlAnh = p.URL_ANH || (p.HINHANH && p.HINHANH.startsWith('http') ? p.HINHANH : null);
        const anhHtml = urlAnh ? `
            <div class="mt-3 p-3 rounded-lg bg-black/30 border border-gold-400/20">
              <div class="text-xs font-bold text-gold-400 mb-1.5"><i class="fa-solid fa-camera mr-1.5"></i>Ảnh bằng chứng hủy hàng:</div>
              <a href="${Formatter.an(urlAnh)}" target="_blank" rel="noopener" class="inline-block group relative">
                <img src="${Formatter.an(urlAnh)}" alt="Bằng chứng" class="max-h-48 rounded border border-white/10 hover:opacity-90 transition-opacity">
                <span class="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-[10px] text-white rounded">
                  <i class="fa-solid fa-up-right-from-square mr-1"></i>Xem ảnh lớn
                </span>
              </a>
            </div>` : '';

        await Dialog.bieuMau(
            Formatter.an(p.SO_PHIEU),
            `<div class="text-left text-sm">
               <table class="w-full">
                 <thead><tr class="text-xs text-gray-400 border-b border-white/10">
                   <th class="py-1 w-8">TT</th><th class="py-1 text-left">Nguyên liệu</th>
                   <th class="py-1 text-right">SL</th>
                   ${coTien ? '<th class="py-1 text-right">Đơn giá</th><th class="py-1 text-right">Thành tiền</th>' : ''}
                 </tr></thead>
                 <tbody>${dong}</tbody>
               </table>
               ${p.GHICHU ? `<div class="mt-3 text-xs text-gray-400">
                               <b>Ghi chú:</b> ${Formatter.an(p.GHICHU)}</div>` : ''}
               ${anhHtml}
             </div>`,
            () => true
        );
    }

    /* ══════════════════════ Lịch sử biến động ══════════════════════ */

    async xemLichSu(manl) {
        const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php', { action: 'lichsu', manl });
        const nl = kq.nguyen_lieu;

        if (!kq.lich_su.length) {
            Dialog.canhBao(nl.TENNL, 'Chưa có biến động nào được ghi nhận.');
            return;
        }

        const ten = { nhap: 'Nhập', xuat: 'Xuất', huy: 'Hủy', kiemke: 'Kiểm kê', khoitao: 'Khởi tạo' };
        const dong = kq.lich_su.map(s => {
            const tang = parseFloat(s.THAYDOI) > 0;
            return `<tr class="border-b border-white/5">
              <td class="py-1.5 text-xs text-gray-400 whitespace-nowrap">
                ${Formatter.ngay(s.NGAYTAO)} ${Formatter.gioPhut(s.NGAYTAO)}</td>
              <td class="py-1.5">${ten[s.LOAI] || s.LOAI}</td>
              <td class="py-1.5 text-right font-semibold ${tang ? 'text-emerald-400' : 'text-orange-400'}">
                ${tang ? '+' : ''}${this.soDep(s.THAYDOI)}</td>
              <td class="py-1.5 text-right text-gray-300">${this.soDep(s.TON_SAU)}</td>
              <td class="py-1.5 text-xs text-gray-500 truncate max-w-40">
                ${Formatter.an(s.GHICHU || '')}</td>
            </tr>`;
        }).join('');

        await Dialog.bieuMau(
            `${Formatter.an(nl.TENNL)} — tồn ${this.soDep(nl.TON_HIENTAI)} ${Formatter.an(nl.DONVI)}`,
            `<div class="text-left text-sm max-h-96 overflow-y-auto">
               <table class="w-full">
                 <thead><tr class="text-xs text-gray-400 border-b border-white/10">
                   <th class="py-1 text-left">Lúc</th><th class="py-1 text-left">Loại</th>
                   <th class="py-1 text-right">Thay đổi</th><th class="py-1 text-right">Tồn sau</th>
                   <th class="py-1 text-left">Ghi chú</th>
                 </tr></thead><tbody>${dong}</tbody>
               </table></div>`,
            () => true
        );
    }

    /* ══════════════════════════ Đối chiếu ══════════════════════════ */

    async doiChieu() {
        const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php', { action: 'doichieu' });

        if (kq.so_lech === 0) {
            Dialog.thanhCong('Sổ kho khớp', kq.ket_luan);
            return;
        }
        // Lệch ở đây KHÔNG phải chuyện người dùng sửa được. Nó nghĩa là có
        // mã nguồn nào đó sửa tồn mà không đi qua sổ — nên thông báo nói
        // thẳng là cần rà mã, đừng gợi ý "chỉnh lại cho khớp".
        Dialog.loi(`Lệch ${kq.so_lech} nguyên liệu`,
            kq.ket_luan + '\n\n' +
            kq.danh_sach.map(x => `${x.TENNL}: bản tóm ${x.TON_BAN_TOM}, sổ ${x.TON_THEO_SO}`).join('\n'));
    }

    /* ═════════════════════ Biểu mẫu lập phiếu ═════════════════════ */

    /**
     * Mở biểu mẫu lập phiếu nhập / xuất / hủy.
     *
     * Dùng hộp thoại rộng của SweetAlert2 thay vì Dialog.bieuMau: phiếu có
     * bảng dòng hàng thêm/bớt được, cần nhiều chỗ hơn 520px mặc định, và
     * cần gắn sự kiện cho các nút bên trong sau khi hộp thoại mở.
     */
    async _moFormPhieu(loai) {
        // Cần danh sách nguyên liệu ĐẦY ĐỦ để đổ vào ô chọn. Không dùng
        // this.nguyenLieu: nếu đang bật bộ lọc thì danh sách đó thiếu, và
        // mặt hàng cần nhập sẽ không có trong ô chọn.
        const kq = await ApiClient.layDanhSach('kho_nguyenlieu.php');
        const dsNL = kq.danh_sach || [];

        const ten = { nhap: 'phiếu nhập kho', xuat: 'phiếu xuất kho', huy: 'biên bản hủy hàng' }[loai];
        const coGia = loai === 'nhap';
        const coHSD = loai === 'nhap';

        const lyDo = {
            xuat: [['bep', 'Xuất cho bếp'], ['sukien', 'Tiệc / sự kiện'], ['khac', 'Khác']],
            huy:  [['hethan', 'Hết hạn sử dụng'], ['hong', 'Hư hỏng'],
                   ['vosinh', 'Không đảm bảo vệ sinh'], ['roivo', 'Rơi vỡ'], ['khac', 'Khác']]
        }[loai];

        this._anhHuyBase64 = null;
        const dauPhieu = loai === 'nhap'
            ? `<div class="pk-hang2">
                 <input id="fNCC" placeholder="Nhà cung cấp" class="pk-o">
                 <input id="fHD" placeholder="Số hóa đơn NCC" class="pk-o">
               </div>`
            : loai === 'huy'
            ? `<div class="pk-hang2">
                 <select id="fLyDo" class="pk-o">
                   ${lyDo.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
                 </select>
                 <input id="fGhiChuNgan" placeholder="Phát hiện khi nào (vd: giao ca sáng)" class="pk-o">
               </div>
               <div class="mb-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                 <div class="flex items-center justify-between mb-1.5">
                   <label class="text-xs font-bold text-red-300 uppercase">
                     <i class="fa-solid fa-camera mr-1"></i>Ảnh bằng chứng hủy hàng (Bắt buộc)
                   </label>
                   <span class="text-[11px] text-gray-400">Chụp hoặc chọn ảnh thực tế</span>
                 </div>
                 <input type="file" id="fHinhAnhHuy" accept="image/*"
                        class="pk-o text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-red-500/20 file:text-red-300 hover:file:bg-red-500/30">
                 <div id="pkAnhPreview" class="mt-2 hidden flex items-center gap-3">
                   <img id="pkAnhPreviewImg" src="" alt="Bằng chứng" class="w-16 h-16 object-cover rounded-lg border border-gold-400/30">
                   <span class="text-xs text-gray-300" id="pkAnhPreviewTen"></span>
                 </div>
               </div>`
            : `<div class="pk-hang2">
                 <select id="fLyDo" class="pk-o">
                   ${lyDo.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
                 </select>
                 <input id="fNguoiNhan" placeholder="Người nhận hàng" class="pk-o">
               </div>`;

        const kqForm = await Swal.fire(this._nenHopThoai({
            title: 'Lập ' + ten,
            width: 780,
            showCancelButton: true,
            confirmButtonText: 'Lưu phiếu',
            cancelButtonText: 'Hủy',
            focusConfirm: false,
            html: `
              <style>
                .pk-o{width:100%;padding:.5rem .7rem;border-radius:.5rem;
                      background:rgba(0,0,0,.25);border:1px solid rgba(212,175,55,.2);
                      color:inherit;font-size:.875rem}
                .pk-o:focus{outline:none;border-color:#D4AF37}
                .pk-hang2{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem}
                #pkBang{width:100%;font-size:.85rem}
                #pkBang th{font-size:.7rem;color:#9aa;text-transform:uppercase;
                           padding:.25rem;text-align:left;font-weight:600}
                #pkBang td{padding:.2rem}
              </style>
              <div style="text-align:left">
                ${dauPhieu}
                <table id="pkBang"><thead><tr>
                  <th style="width:42%">Nguyên liệu</th>
                  <th style="width:16%">Số lượng</th>
                  ${coGia ? '<th style="width:20%">Đơn giá</th>' : ''}
                  ${coHSD ? '<th style="width:18%">Hạn SD</th>' : ''}
                  <th style="width:6%"></th>
                </tr></thead><tbody id="pkThan"></tbody></table>
                <button type="button" id="pkThem"
                  style="margin-top:.5rem;font-size:.8rem;color:#D4AF37;font-weight:700">
                  + Thêm dòng</button>
                <input id="fGhiChu" placeholder="Ghi chú" class="pk-o" style="margin-top:.75rem">
                <div id="pkTong" style="margin-top:.6rem;text-align:right;font-weight:700;
                     color:#D4AF37"></div>
              </div>`,
            didOpen: () => {
                this._ganFormPhieu(dsNL, coGia, coHSD);
                if (loai === 'huy') {
                    const inputAnh = document.getElementById('fHinhAnhHuy');
                    const vungPrev = document.getElementById('pkAnhPreview');
                    const imgPrev  = document.getElementById('pkAnhPreviewImg');
                    const tenPrev  = document.getElementById('pkAnhPreviewTen');
                    if (inputAnh) {
                        inputAnh.addEventListener('change', (e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    this._anhHuyBase64 = ev.target.result;
                                    if (imgPrev) imgPrev.src = ev.target.result;
                                    if (tenPrev) tenPrev.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
                                    if (vungPrev) vungPrev.classList.remove('hidden');
                                };
                                reader.readAsDataURL(file);
                            } else {
                                this._anhHuyBase64 = null;
                                if (vungPrev) vungPrev.classList.add('hidden');
                            }
                        });
                    }
                }
            },
            preConfirm: () => {
                const dong = this._docDongPhieu(coGia, coHSD);
                if (!dong.length) {
                    Swal.showValidationMessage('Phiếu phải có ít nhất một dòng hợp lệ.');
                    return false;
                }
                if (loai === 'huy' && !this._anhHuyBase64) {
                    Swal.showValidationMessage('Phiếu hủy phải có ảnh bằng chứng. Hãy chụp hoặc chọn một ảnh.');
                    return false;
                }
                return {
                    dong,
                    nhacungcap: document.getElementById('fNCC')?.value || '',
                    so_hd_ncc:  document.getElementById('fHD')?.value || '',
                    lydo:       document.getElementById('fLyDo')?.value || '',
                    nguoi_nhan: document.getElementById('fNguoiNhan')?.value || '',
                    hinhanh_base64: loai === 'huy' ? this._anhHuyBase64 : undefined,
                    ghichu:     [document.getElementById('fGhiChuNgan')?.value,
                                 document.getElementById('fGhiChu')?.value]
                                .filter(Boolean).join(' — ')
                };
            }
        }));

        if (!kqForm.isConfirmed) return;

        const goiTin = {
            action: 'tao', loai,
            // Dòng hàng là mảng lồng nhau mà ApiClient gửi form-urlencoded,
            // nên đóng thành chuỗi JSON trong một trường. `doc_dong_hang()`
            // bên máy chủ nhận được cả hai kiểu.
            dong:       JSON.stringify(kqForm.value.dong),
            nhacungcap: kqForm.value.nhacungcap,
            so_hd_ncc:  kqForm.value.so_hd_ncc,
            lydo:       kqForm.value.lydo,
            nguoi_nhan: kqForm.value.nguoi_nhan,
            ghichu:     kqForm.value.ghichu
        };
        if (loai === 'huy' && kqForm.value.hinhanh_base64) {
            goiTin.hinhanh_base64 = kqForm.value.hinhanh_base64;
        }
        const kqLuu = await ApiClient.ghi('kho_phieu.php', goiTin);

        await Dialog.thanhCong('Đã lưu', kqLuu.message);
        await this.nap();

        if (await Dialog.xacNhan('In phiếu?', kqLuu.phieu.so_phieu, 'In ngay')) {
            const ma = kqLuu.phieu.maphieunhap ?? kqLuu.phieu.maphieuxuat ?? kqLuu.phieu.maphieuhuy;
            await this.inPhieu(loai, ma);
        }
    }

    /** Gắn sự kiện cho bảng dòng hàng sau khi hộp thoại đã mở. */
    _ganFormPhieu(dsNL, coGia, coHSD) {
        const than = document.getElementById('pkThan');
        const oNL  = dsNL.map(n =>
            `<option value="${n.MANL}" data-gia="${n.GIA_NHAP_GANNHAT}">
               ${Formatter.an(n.TENNL)} (${Formatter.an(n.DONVI)})</option>`).join('');

        const themDong = () => {
            const tr = document.createElement('tr');
            tr.innerHTML =
              `<td><select class="pk-o pk-nl"><option value="">— chọn —</option>${oNL}</select></td>
               <td><input type="number" step="0.001" min="0" class="pk-o pk-sl" placeholder="0"></td>` +
              (coGia ? '<td><input type="number" step="1000" min="0" class="pk-o pk-gia" placeholder="0"></td>' : '') +
              (coHSD ? '<td><input type="date" class="pk-o pk-hsd"></td>' : '') +
              `<td><button type="button" class="pk-xoa"
                     style="color:#f87171;font-weight:700;font-size:1.1rem">×</button></td>`;
            than.appendChild(tr);
        };

        const tinhTong = () => {
            if (!coGia) return;
            let t = 0;
            than.querySelectorAll('tr').forEach(tr => {
                const sl  = parseFloat(tr.querySelector('.pk-sl')?.value || 0);
                const gia = parseFloat(tr.querySelector('.pk-gia')?.value || 0);
                if (sl > 0 && gia > 0) t += sl * gia;
            });
            const o = document.getElementById('pkTong');
            if (o) o.textContent = t > 0 ? 'Tổng: ' + Formatter.tien(Math.round(t)) + ' ₫' : '';
        };

        themDong();
        document.getElementById('pkThem').addEventListener('click', themDong);

        than.addEventListener('click', (e) => {
            if (!e.target.classList.contains('pk-xoa')) return;
            // Luôn chừa lại một dòng: xóa hết thì bảng trống trơn và người
            // dùng không còn chỗ nào để bắt đầu lại.
            if (than.querySelectorAll('tr').length > 1) {
                e.target.closest('tr').remove();
            } else {
                e.target.closest('tr').querySelectorAll('input,select').forEach(o => { o.value = ''; });
            }
            tinhTong();
        });

        than.addEventListener('change', (e) => {
            // Chọn nguyên liệu thì điền sẵn giá nhập gần nhất. Người nhập
            // sửa được, nhưng phần lớn lần nhập giá không đổi nên bắt gõ
            // lại là việc thừa và dễ sai.
            if (e.target.classList.contains('pk-nl') && coGia) {
                const chon = e.target.selectedOptions[0];
                const oGia = e.target.closest('tr').querySelector('.pk-gia');
                if (chon && chon.dataset.gia && oGia && !oGia.value) oGia.value = chon.dataset.gia;
            }
            tinhTong();
        });
        than.addEventListener('input', tinhTong);
    }

    /** Đọc các dòng hợp lệ, bỏ qua dòng chưa điền đủ. */
    _docDongPhieu(coGia, coHSD) {
        const dong = [];
        document.querySelectorAll('#pkThan tr').forEach(tr => {
            const manl = parseInt(tr.querySelector('.pk-nl')?.value || 0, 10);
            const sl   = parseFloat(tr.querySelector('.pk-sl')?.value || 0);
            if (!manl || !(sl > 0)) return;

            const d = { manl, soluong: sl };
            if (coGia) d.dongia = parseInt(tr.querySelector('.pk-gia')?.value || 0, 10);
            if (coHSD) {
                const h = tr.querySelector('.pk-hsd')?.value;
                if (h) d.hansudung = h;
            }
            dong.push(d);
        });
        return dong;
    }

    /* ══════════════════════════ Kiểm kê ══════════════════════════ */

    /**
     * Mở bảng đếm kho.
     *
     * Chỉ liệt kê nguyên liệu ĐANG HIỂN THỊ theo bộ lọc. Bắt đếm cả 97 mặt
     * hàng một lượt là không thực tế — thủ kho đếm theo khu, nên lọc nhóm
     * rồi đếm nhóm đó mới đúng cách làm thật.
     *
     * Ô để TRỐNG nghĩa là "không đếm mặt hàng này", khác hẳn số 0 nghĩa là
     * "đã đếm, còn 0". Gộp hai cái thì mở bảng ra bấm lưu ngay sẽ quét sạch
     * toàn bộ tồn kho về 0 — một cú bấm nhầm xóa cả kho.
     */
    async moKiemKe() {
        if (!this.nguyenLieu.length) {
            Dialog.canhBao('Chưa có gì để kiểm kê', 'Bộ lọc hiện tại không ra nguyên liệu nào.');
            return;
        }

        const hang = this.nguyenLieu.map(n => `
            <tr>
              <td style="padding:.2rem .4rem">${Formatter.an(n.TENNL)}</td>
              <td style="padding:.2rem .4rem;text-align:right;color:#9aa">
                ${this.soDep(n.TON_HIENTAI)} ${Formatter.an(n.DONVI)}</td>
              <td style="padding:.2rem"><input type="number" step="0.001" min="0"
                    class="kk-o" data-manl="${n.MANL}" placeholder="—"
                    style="width:100%;padding:.35rem .5rem;border-radius:.4rem;
                           background:rgba(0,0,0,.25);border:1px solid rgba(212,175,55,.2);
                           color:inherit;font-size:.85rem"></td>
            </tr>`).join('');

        const kq = await Swal.fire(this._nenHopThoai({
            title: `Kiểm kê ${this.nguyenLieu.length} nguyên liệu`,
            width: 640,
            showCancelButton: true,
            confirmButtonText: 'Ghi kết quả',
            cancelButtonText: 'Hủy',
            focusConfirm: false,
            html: `
              <div style="text-align:left;font-size:.85rem">
                <div style="color:#9aa;margin-bottom:.6rem">
                  Điền số đếm được. <b>Để trống</b> nghĩa là không đếm mặt hàng đó —
                  tồn giữ nguyên.
                </div>
                <div style="max-height:22rem;overflow-y:auto">
                  <table style="width:100%">
                    <thead><tr style="font-size:.7rem;color:#9aa;text-transform:uppercase">
                      <th style="text-align:left;padding:.2rem .4rem">Nguyên liệu</th>
                      <th style="text-align:right;padding:.2rem .4rem">Sổ ghi</th>
                      <th style="text-align:left;padding:.2rem">Đếm được</th>
                    </tr></thead><tbody>${hang}</tbody>
                  </table>
                </div>
                <input id="kkGhiChu" placeholder="Ghi chú (ca nào, ai đếm…)"
                  style="width:100%;margin-top:.7rem;padding:.5rem .7rem;border-radius:.5rem;
                         background:rgba(0,0,0,.25);border:1px solid rgba(212,175,55,.2);
                         color:inherit;font-size:.85rem">
              </div>`,
            preConfirm: () => {
                const dong = [];
                document.querySelectorAll('.kk-o').forEach(o => {
                    if (o.value.trim() === '') return;    // để trống = không đếm
                    dong.push({ manl: parseInt(o.dataset.manl, 10),
                                ton_thucte: parseFloat(o.value) });
                });
                if (!dong.length) {
                    Swal.showValidationMessage('Chưa điền số đếm được của mặt hàng nào.');
                    return false;
                }
                return { dong, ghichu: document.getElementById('kkGhiChu')?.value || '' };
            }
        }));

        if (!kq.isConfirmed) return;

        const r = await ApiClient.ghi('kho_nguyenlieu.php', {
            action: 'kiemke',
            dong:   JSON.stringify(kq.value.dong),
            ghichu: kq.value.ghichu
        });

        if (r.so_lech === 0) {
            await Dialog.thanhCong('Khớp sổ', r.message);
        } else {
            await Dialog.canhBao(r.message, r.chi_tiet.map(x =>
                `${x.tennl}: sổ ${x.ton_so} → đếm ${x.ton_thucte} ` +
                `(${x.chenh_lech > 0 ? '+' : ''}${x.chenh_lech})`).join('\n'));
        }
        await this.nap();
    }

    /* ══════════════════════════ Tiện ích ══════════════════════════ */

    /**
     * Thêm màu nền/chữ theo chủ đề vào cấu hình SweetAlert2.
     *
     * Dialog đã làm việc này cho các hộp thoại chuẩn, nhưng hai hộp thoại
     * ở màn này gọi thẳng Swal.fire vì cần `didOpen` và `width` riêng —
     * thiếu bước này thì chúng lạc tông hẳn so với phần còn lại.
     */
    _nenHopThoai(cauHinh) {
        const toi = document.documentElement.classList.contains('dark');
        return Object.assign({
            background: toi ? '#1e293b' : '#ffffff',
            color:      toi ? '#f1f5f9' : '#0f172a',
            confirmButtonColor: '#D4AF37',
            cancelButtonColor:  '#334155'
        }, cauHinh);
    }

    /** 1.500 -> "1,5" · 2.000 -> "2" (dấu phẩy kiểu Việt Nam) */
    soDep(n) {
        const s = parseFloat(n);
        if (!Number.isFinite(s)) return '0';
        return s.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
    }

    _trong(loi) {
        return `<div class="text-center py-16 text-gray-500">
                  <i class="fa-solid fa-box-open text-4xl mb-3 opacity-40"></i>
                  <div class="text-sm">${Formatter.an(loi)}</div></div>`;
    }
}
