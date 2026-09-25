import { ApiClient } from '../core/ApiClient.js';
import { Dialog }    from '../core/Dialog.js';
import { Formatter } from '../core/Formatter.js';
import { SocketBus } from '../core/SocketBus.js';

/**
 * ChatScreen — hộp thư chăm sóc khách hàng cho trang quản trị.
 *
 *
 * VÌ SAO KHÔNG KẾ THỪA CrudScreen
 * ================================
 * CrudScreen dựng ra một bảng có nút thêm/sửa/xóa. Màn này không phải vậy:
 * nó là hộp thư hai cột — danh sách hội thoại bên trái, khung trò chuyện bên
 * phải — và thứ người dùng "tạo" ở đây là một câu trả lời trong ngữ cảnh,
 * chứ không phải một bản ghi trong biểu mẫu.
 *
 * Ép nó vào CrudScreen sẽ phải ghi đè gần như mọi phương thức, tức là thừa
 * kế chỉ để lấy vài dòng tiện ích.
 *
 *
 * CÁCH BIẾT CÓ TIN MỚI
 * ====================
 * Hai đường, giống hệt lý do đã ghi ở ChatActivity bên app:
 *   1. Socket.IO `chat_moi` — tức thời, đường chính.
 *   2. Hỏi lại mỗi 10 giây — lưới an toàn, vì socket đứt trong im lặng.
 *
 * Vòng hỏi lại CHỈ chạy khi tab đang mở. Không kiểm tra điều đó thì trang
 * quản trị mở suốt ca sẽ gọi mạng cả nghìn lần cho một tab không ai nhìn.
 */
export class ChatScreen {

    static CHU_KY_MS = 10000;

    constructor() {
        this.danhSach   = [];
        this.dangMo     = null;   // hội thoại đang xem
        this.tinDangCo  = [];
        this.boLoc      = '';
        this.tabDangMo  = false;
        this._hen       = null;
        this._ngheTin   = null;
    }

    /* ══════════════════════ Vòng đời ══════════════════════ */

    async khoiDong() {
        this.tabDangMo = true;
        await this.napDanhSach();
        this._batHoiLai();
        this._dangKySocket();
    }

    /** Gọi khi người dùng chuyển sang tab khác. */
    tamDung() {
        this.tabDangMo = false;
        if (this._hen) { clearInterval(this._hen); this._hen = null; }
    }

    async moLai() {
        this.tabDangMo = true;
        await this.napDanhSach();
        if (this.dangMo) await this.moHoiThoai(this.dangMo.MAHOITHOAI);
        this._batHoiLai();
    }

    _batHoiLai() {
        if (this._hen) clearInterval(this._hen);
        this._hen = setInterval(() => {
            if (!this.tabDangMo) return;
            this.napDanhSach().catch(() => {});
            if (this.dangMo) this._hoiTinMoi().catch(() => {});
        }, ChatScreen.CHU_KY_MS);
    }

    _dangKySocket() {
        if (this._ngheTin) return;
        this._ngheTin = () => {
            // Không dựng lại từ dữ liệu trong sự kiện mà hỏi lại máy chủ.
            //
            // Sự kiện chỉ mang MỘT tin; số chưa đọc, trạng thái hội thoại và
            // thứ tự sắp xếp đều nằm ở chỗ khác. Tự suy ra chúng ở đây là mở
            // đường cho giao diện lệch với cơ sở dữ liệu.
            if (!this.tabDangMo) return;
            this.napDanhSach().catch(() => {});
            if (this.dangMo) this._hoiTinMoi().catch(() => {});
        };
        SocketBus.nghe('chat_moi', this._ngheTin);
    }

    /* ══════════════════════ Dữ liệu ══════════════════════ */

    async napDanhSach() {
        const thamSo = { limit: 50 };
        if (this.boLoc) thamSo.loc = this.boLoc;

        const kq = await ApiClient.layDanhSach('chat_nhan_vien.php', thamSo);
        this.danhSach = kq.data || [];
        this._veDanhSach();
        this._veHuyHieuTab(kq.so_cho || 0);
    }

    async moHoiThoai(ma) {
        const kq = await ApiClient.layDanhSach('chat_lay.php', { mahoithoai: ma });
        this.dangMo    = kq.hoi_thoai;
        this.tinDangCo = kq.tin_nhan || [];
        this._veKhungChat();
        this._cuonXuongCuoi();
        // Vừa mở ra là đã đọc, nên số chưa đọc bên danh sách phải đổi theo.
        this.napDanhSach().catch(() => {});
    }

    async _hoiTinMoi() {
        if (!this.dangMo) return;
        const cuoi = this.tinDangCo.length
            ? this.tinDangCo[this.tinDangCo.length - 1].MATINNHAN : 0;

        const kq = await ApiClient.layDanhSach('chat_lay.php',
            { mahoithoai: this.dangMo.MAHOITHOAI, tu_tin: cuoi });

        const moi = kq.tin_nhan || [];
        if (!moi.length) return;

        this.tinDangCo = this.tinDangCo.concat(moi);
        this.dangMo    = kq.hoi_thoai || this.dangMo;
        this._veKhungChat();
        this._cuonXuongCuoi();
    }

    async guiTraLoi(noiDung) {
        if (!this.dangMo || !noiDung.trim()) return;

        await ApiClient.ghi('chat_nhan_vien.php', {
            action:     'traloi',
            mahoithoai: this.dangMo.MAHOITHOAI,
            noidung:    noiDung.trim(),
        });

        await this._hoiTinMoi();
        await this.napDanhSach();
    }

    /**
     * "Hoàn tất" — KHÔNG đóng ngay mà hỏi khách một câu.
     *
     * Đóng thẳng thì khách chỉ còn cách mở hội thoại mới, và hội thoại mới
     * không mang theo lịch sử. Với một khiếu nại thì bắt khách kể lại từ đầu
     * là cách nhanh nhất làm họ bực thêm.
     */
    async dongHoiThoai() {
        if (!this.dangMo) return;
        const dong = await Dialog.xacNhan(
            'Đánh dấu đã hoàn tất?',
            'Khách sẽ được hỏi lại xem còn cần hỗ trợ gì không. Hội thoại chỉ đóng khi khách đồng ý.',
            'Hoàn tất');
        if (!dong) return;

        await ApiClient.ghi('chat_nhan_vien.php', {
            action: 'dong', mahoithoai: this.dangMo.MAHOITHOAI,
        });
        await this.moHoiThoai(this.dangMo.MAHOITHOAI);
        await this.napDanhSach();
    }

    /**
     * "Đóng hẳn" — dùng khi khách không trả lời câu hỏi xác nhận.
     *
     * Chỉ hiện ở trạng thái `chodong`. Không cho đóng thẳng từ `dangxuly`:
     * hỏi khách một câu trước là cả điểm của trạng thái này.
     */
    async dongHan() {
        if (!this.dangMo) return;
        const dong = await Dialog.xacNhan(
            'Đóng hẳn hội thoại?',
            'Dùng khi khách không phản hồi. Khách vẫn nhắn lại được, nhưng sẽ mở một cuộc trò chuyện mới.',
            'Đóng hẳn');
        if (!dong) return;

        await ApiClient.ghi('chat_nhan_vien.php', {
            action: 'donghan', mahoithoai: this.dangMo.MAHOITHOAI,
        });
        await this.napDanhSach();
        this.dangMo = null;
        this.tinDangCo = [];
        this._veKhungChat();
    }

    doiBoLoc(loc) {
        this.boLoc = loc || '';
        this.napDanhSach().catch(() => {});
    }

    /* ══════════════════════ Vẽ giao diện ══════════════════════ */

    _veDanhSach() {
        const khung = document.getElementById('chatDanhSach');
        if (!khung) return;

        if (!this.danhSach.length) {
            khung.innerHTML = `
                <div class="p-8 text-center text-gray-500 text-sm">
                    <i class="fa-regular fa-comments text-3xl mb-3 block opacity-40"></i>
                    Chưa có cuộc trò chuyện nào.
                </div>`;
            return;
        }

        khung.innerHTML = this.danhSach.map(h => {
            const dangChon = this.dangMo && this.dangMo.MAHOITHOAI === h.MAHOITHOAI;
            const chuaDoc  = h.SO_CHUA_DOC_NV > 0;

            // Ai nói câu cuối, để nhân viên liếc là biết có đang chờ mình không
            const nhan = h.NGUOIGUI_CUOI === 'khach' ? ''
                       : h.NGUOIGUI_CUOI === 'bot'   ? '<span class="text-gold-400/70">Bot: </span>'
                       : '<span class="text-gray-500">Bạn: </span>';

            return `
            <button class="chat-muc w-full text-left px-4 py-3 border-b border-gold-400/5
                           hover:bg-white/5 transition flex gap-3
                           ${dangChon ? 'bg-gold-400/10' : ''}"
                    data-ma="${h.MAHOITHOAI}">
                <div class="w-9 h-9 shrink-0 rounded-full grid place-items-center
                            text-sm font-bold ${ChatScreen._mauAvatar(h.MAKH)}">
                    ${Formatter.an(ChatScreen._chuDau(h.TEN_KHACH))}
                </div>
                <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <span class="text-sm font-semibold truncate
                                 ${chuaDoc ? 'text-white' : 'text-gray-300'}">
                        ${Formatter.an(h.TEN_KHACH)}
                    </span>
                    ${chuaDoc
                        ? `<span class="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-red-500
                                        text-white text-[11px] font-bold grid place-items-center">
                               ${h.SO_CHUA_DOC_NV > 9 ? '9+' : h.SO_CHUA_DOC_NV}
                           </span>`
                        : `<span class="shrink-0 text-[11px] text-gray-500">
                               ${Formatter.gioPhut(h.CAPNHAT)}
                           </span>`}
                </div>
                <div class="text-xs text-gray-400 truncate mt-0.5">
                    ${nhan}${Formatter.an(h.TIN_CUOI || '(chưa có tin)')}
                </div>
                <div class="flex items-center gap-2 mt-1.5">
                    ${this._theTrangThai(h.TINHTRANG)}
                    ${h.TINHTRANG === 'mo' && h.BOT_HOATDONG === 'false'
                        ? `<span class="text-[10px] px-2 py-0.5 rounded-full border
                                        bg-rose-500/15 text-rose-300 border-rose-500/30">
                               Khách xin gặp người
                           </span>`
                        : ''}
                    ${h.TEN_NV_XULY
                        ? `<span class="text-[10px] text-gray-500">· ${Formatter.an(h.TEN_NV_XULY)}</span>`
                        : ''}
                </div>
                </div>
            </button>`;
        }).join('');

        khung.querySelectorAll('.chat-muc').forEach(nut => {
            nut.addEventListener('click',
                () => this.moHoiThoai(parseInt(nut.dataset.ma, 10)).catch(e => Dialog.loiApi(e)));
        });
    }

    /** Chữ cái đầu của TÊN (từ cuối), giống cách người Việt xưng hô. */
    static _chuDau(ten) {
        const phan = String(ten || '?').trim().split(/\s+/);
        return (phan[phan.length - 1][0] || '?').toUpperCase();
    }

    /**
     * Màu nền ảnh đại diện, suy từ mã khách.
     *
     * Suy ra thay vì lưu: cùng một khách luôn ra cùng một màu, nên nhân viên
     * nhận ra người quen trong danh sách trước cả khi đọc tên. Mà không phải
     * thêm cột nào vào CSDL.
     *
     * Danh sách viết đầy đủ chứ không ghép chuỗi — Tailwind quét mã nguồn để
     * biết cần sinh class nào, `bg-${x}-500/25` không bao giờ xuất hiện
     * nguyên vẹn nên sẽ không có màu. Đã vấp ba lần (QĐ-024, QĐ-071, QĐ-074).
     */
    static _mauAvatar(makh) {
        const bang = [
            'bg-rose-500/25 text-rose-200',
            'bg-amber-500/25 text-amber-200',
            'bg-emerald-500/25 text-emerald-200',
            'bg-sky-500/25 text-sky-200',
            'bg-violet-500/25 text-violet-200',
            'bg-teal-500/25 text-teal-200',
        ];
        return bang[Math.abs(Number(makh) || 0) % bang.length];
    }

    _theTrangThai(tt) {
        // Chuỗi class viết ĐẦY ĐỦ, không ghép động.
        //
        // Tailwind quét mã nguồn để biết cần sinh ra class nào; một chuỗi như
        // `bg-${mau}-500/15` không bao giờ xuất hiện nguyên vẹn trong tệp nên
        // class đó không được sinh ra và thẻ hiện ra không màu. Đã vấp đúng
        // lỗi này hai lần — xem QĐ-024 và QĐ-071.
        const kieu = {
            mo:       'bg-amber-500/15 text-amber-300 border-amber-500/30',
            dangxuly: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
            chodong:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
            daxong:   'bg-gray-500/15 text-gray-400 border-gray-500/30',
        };
        const chu = {
            mo: 'Chờ xử lý', dangxuly: 'Đang xử lý',
            chodong: 'Chờ khách xác nhận', daxong: 'Đã xong',
        };
        return `<span class="text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${kieu[tt] || kieu.daxong}">
                    ${chu[tt] || tt}
                </span>`;
    }

    _veKhungChat() {
        const khung = document.getElementById('chatKhung');
        if (!khung) return;

        if (!this.dangMo) {
            khung.innerHTML = `
                <div class="h-full grid place-items-center text-gray-500 text-sm">
                    <div class="text-center">
                        <i class="fa-regular fa-comment-dots text-4xl mb-3 block opacity-30"></i>
                        Chọn một cuộc trò chuyện bên trái để bắt đầu.
                    </div>
                </div>`;
            return;
        }

        const h = this.dangMo;
        const daXong = h.TINHTRANG === 'daxong';

        khung.innerHTML = `
            <div class="flex items-center justify-between px-5 py-3 border-b border-gold-400/10 shrink-0">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 shrink-0 rounded-full grid place-items-center
                                text-base font-bold ${ChatScreen._mauAvatar(h.MAKH)}">
                        ${Formatter.an(ChatScreen._chuDau(h.TEN_KHACH))}
                    </div>
                    <div class="min-w-0">
                        <div class="text-white font-semibold text-sm truncate">${Formatter.an(h.TEN_KHACH)}</div>
                        <div class="text-xs text-gray-400 truncate">
                            ${Formatter.an(h.SDT_KHACH || 'Không có số điện thoại')}
                            · Hội thoại #${h.MAHOITHOAI}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    ${this._theTrangThai(h.TINHTRANG)}
                    ${/*
                       Ẩn "Hoàn tất" khi đã đang chờ khách: bấm lần nữa chỉ gửi
                       thêm một câu hỏi y hệt câu khách chưa trả lời. Ở trạng thái
                       đó, việc duy nhất còn ý nghĩa là "Đóng hẳn".
                    */ ''}
                    ${daXong || h.TINHTRANG === 'chodong' ? '' : `
                    <button id="chatNutDong"
                            class="px-3 py-1.5 rounded-lg border border-gold-400/30 text-gold-400
                                   text-xs font-semibold hover:bg-gold-400 hover:text-royal-900 transition">
                        <i class="fa-solid fa-check mr-1"></i>Hoàn tất
                    </button>`}
                    ${h.TINHTRANG === 'chodong' ? `
                    <button id="chatNutDongHan"
                            class="px-3 py-1.5 rounded-lg border border-gray-500/40 text-gray-400
                                   text-xs font-semibold hover:bg-gray-600 hover:text-white transition">
                        Đóng hẳn
                    </button>` : ''}
                </div>
            </div>

            <div id="chatDongTin" class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                ${this.tinDangCo.map(t => this._veTin(t)).join('')}
            </div>

            <div class="border-t border-gold-400/10 p-3 shrink-0">
                ${h.BOT_HOATDONG === 'false' ? `
                <div class="text-[11px] text-gray-500 mb-2 flex items-center gap-1.5">
                    <i class="fa-solid fa-robot"></i>
                    Trợ lý tự động đã tắt cho hội thoại này — khách chỉ nhận được
                    câu trả lời của người thật.
                </div>` : ''}
                <!-- pr-16: chừa chỗ cho nút nhạc nổi (cố định góc phải dưới,
                     music-player.js) — không chừa thì nó đè lên nút gửi (H30). -->
                <div class="flex items-end gap-2 pr-16">
                    <textarea id="chatONhap" rows="1" maxlength="2000"
                              placeholder="Nhập câu trả lời… (Enter để gửi, Shift+Enter xuống dòng)"
                              class="flex-1 resize-none rounded-xl bg-black/30 border border-gold-400/20
                                     px-4 py-2.5 text-sm text-white placeholder-gray-500
                                     focus:outline-none focus:border-gold-400/60"></textarea>
                    <button id="chatNutGui"
                            class="w-10 h-10 rounded-xl bg-gold-400 text-royal-900 shrink-0
                                   hover:brightness-110 transition grid place-items-center">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>`;

        this._ganSuKienKhung();
    }

    // Nội dung tin phải đặt SÁT thẻ: khối dùng whitespace-pre-wrap nên mọi xuống
    // dòng và khoảng trắng thụt lề của chính mẫu HTML này đều hiện ra thành
    // chữ thụt đầu dòng trong bong bóng (H30).
    _veTin(t) {
        const gio = Formatter.gioPhut(t.NGAYTAO);

        if (t.NGUOIGUI === 'khach') {
            return `
            <div class="flex justify-start">
                <div class="max-w-[75%]">
                    <div class="rounded-2xl rounded-bl-sm bg-white/8 border border-white/10
                                px-4 py-2.5 text-sm text-gray-100 whitespace-pre-wrap break-words">${Formatter.an(t.NOIDUNG)}</div>
                    <div class="text-[10px] text-gray-500 mt-1 ml-1">${gio}</div>
                </div>
            </div>`;
        }

        const laBot = t.NGUOIGUI === 'bot';
        const ten   = laBot ? 'Trợ lý tự động' : (t.TEN_HIENTHI || 'Nhân viên');
        // Bot phải TRÔNG KHÁC hẳn nhân viên: nhân viên nhìn lướt cần biết ngay
        // câu nào máy đã đáp hộ, để không trả lời lặp lại điều khách biết rồi.
        //
        // Bản đầu dùng amber nhạt cho bot và vàng cho nhân viên — trên nền tối
        // hai màu đó gần như một, nhìn lướt không tách được. Nay bot dùng VIỀN
        // ĐỨT NÉT và chữ nghiêng: khác về HÌNH DẠNG chứ không chỉ khác sắc độ,
        // nên phân biệt được ngay cả khi liếc nhanh.
        const nen   = laBot
            ? 'bg-transparent border-dashed border-gray-400/40 text-gray-400 italic'
            : 'bg-gold-400/15 border-gold-400/30 text-white';

        return `
        <div class="flex justify-end">
            <div class="max-w-[75%]">
                <div class="text-[10px] text-gray-500 mb-1 mr-1 text-right">
                    ${laBot ? '<i class="fa-solid fa-robot mr-1"></i>' : ''}${Formatter.an(ten)}
                </div>
                <div class="rounded-2xl rounded-br-sm border ${nen}
                            px-4 py-2.5 text-sm whitespace-pre-wrap break-words">${Formatter.an(t.NOIDUNG)}</div>
                <div class="text-[10px] text-gray-500 mt-1 mr-1 text-right">${gio}</div>
            </div>
        </div>`;
    }

    _ganSuKienKhung() {
        const oNhap = document.getElementById('chatONhap');
        const nutGui = document.getElementById('chatNutGui');
        const nutDong = document.getElementById('chatNutDong');

        const gui = async () => {
            if (!oNhap || !oNhap.value.trim()) return;
            const noiDung = oNhap.value;
            oNhap.value = '';
            oNhap.disabled = true;
            try {
                await this.guiTraLoi(noiDung);
            } catch (e) {
                // Trả chữ về ô nhập. Nhân viên vừa gõ một câu trả lời khiếu
                // nại dài; nuốt mất nó vì lỗi mạng là điều không thể chấp nhận.
                oNhap.value = noiDung;
                Dialog.loi('Không gửi được', (e && e.message) || 'Vui lòng thử lại.');
            } finally {
                oNhap.disabled = false;
                oNhap.focus();
            }
        };

        if (nutGui) nutGui.addEventListener('click', gui);
        if (nutDong) nutDong.addEventListener('click',
            () => this.dongHoiThoai().catch(e => Dialog.loiApi(e)));

        const nutDongHan = document.getElementById('chatNutDongHan');
        if (nutDongHan) nutDongHan.addEventListener('click',
            () => this.dongHan().catch(e => Dialog.loiApi(e)));

        if (oNhap) {
            oNhap.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    gui();
                }
            });
            // Ô nhập tự cao lên theo nội dung, tối đa 5 dòng.
            oNhap.addEventListener('input', () => {
                oNhap.style.height = 'auto';
                oNhap.style.height = Math.min(oNhap.scrollHeight, 120) + 'px';
            });
        }
    }

    _cuonXuongCuoi() {
        // Chờ trình duyệt bố trí xong rồi mới cuộn.
        //
        // Gọi thẳng sau khi gán innerHTML thì `scrollHeight` vẫn là chiều cao
        // CŨ — trình duyệt chưa kịp tính lại — nên khung dừng ở giữa cuộc trò
        // chuyện. Đã thấy đúng vậy khi chạy thử: mở hội thoại ra thì thấy tin
        // lúc 17:47 chứ không phải tin mới nhất lúc 17:55.
        requestAnimationFrame(() => {
            const o = document.getElementById('chatDongTin');
            if (o) o.scrollTop = o.scrollHeight;
        });
    }

    _veHuyHieuTab(soCho) {
        const o = document.getElementById('navChatHuyHieu');
        if (!o) return;
        if (soCho > 0) {
            o.textContent = soCho > 9 ? '9+' : String(soCho);
            o.classList.remove('hidden');
        } else {
            o.classList.add('hidden');
        }
    }
}
