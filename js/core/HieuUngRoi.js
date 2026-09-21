/**
 * HieuUngRoi — ảnh nguyên liệu nảy lên rồi rơi xuống khi bị trừ khỏi kho.
 *
 *
 * VÌ SAO DÙNG WEB ANIMATIONS API, KHÔNG DÙNG THƯ VIỆN
 * ====================================================
 * Mỗi hạt chỉ cần một đường bay: nảy lên một chút, rơi theo trọng lực,
 * trôi ngang, xoay, mờ dần. `element.animate()` làm được hết việc đó, chạy
 * trên luồng tổng hợp của trình duyệt (không giật khi luồng chính bận vẽ
 * lại danh sách), và không phải tải thêm một thư viện vật lý chỉ để làm
 * rơi vài tấm ảnh.
 *
 *
 * TRỌNG LỰC NẰM TRONG KEYFRAME, KHÔNG NẰM TRONG EASING
 * =====================================================
 * Một đường cong easing chỉ điều khiển được TỐC ĐỘ dọc theo đường thẳng
 * giữa hai điểm — không vẽ được đường vòng "nảy lên rồi rơi". Nên tính
 * sẵn vị trí ở 12 thời điểm theo công thức
 *
 *        y(t) = rơi·t²  −  nảy·sin(π·t)
 *
 * (t² là trọng lực; sin(πt) là cú nảy lên lúc đầu, về 0 ở cuối) rồi nội
 * suy thẳng giữa chúng. 12 mốc đủ để mắt thấy là đường cong liền.
 *
 *
 * GIỚI HẠN SỐ HẠT
 * ===============
 * Một đơn lẩu hải sản trừ 6 nguyên liệu, mỗi cái vài hạt; năm đơn tới cùng
 * lúc là cả trăm tấm ảnh bay cùng một khung hình. Máy yếu sẽ giật hẳn. Nên
 * có trần `TRAN_HAT` — vượt trần thì bỏ bớt hạt chứ không bỏ lượt trừ kho:
 * con số trên màn hình vẫn luôn đúng, chỉ phần trang trí là bị cắt.
 *
 *
 * NGƯỜI DÙNG TẮT CHUYỂN ĐỘNG
 * ==========================
 * `prefers-reduced-motion` bật thì không cho hạt bay — chỉ còn ô nguyên
 * liệu đổi màu nhẹ và số đếm lùi. Người bị chóng mặt vì chuyển động vẫn
 * thấy được thông tin, chỉ không thấy phần trang trí.
 */
export class HieuUngRoi {

    static TRAN_HAT = 48;
    static _dangBay = 0;
    static _daCaiCss = false;

    static giamChuyenDong() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    /** Cài CSS dùng chung một lần duy nhất. */
    static caiCss() {
        if (HieuUngRoi._daCaiCss) return;
        HieuUngRoi._daCaiCss = true;

        const st = document.createElement('style');
        st.textContent = `
          .kho-hat{position:fixed;z-index:9999;pointer-events:none;border-radius:12px;
                   object-fit:cover;box-shadow:0 6px 18px rgba(0,0,0,.45);
                   border:2px solid rgba(212,175,55,.55);will-change:transform,opacity}
          .kho-hat-chu{display:grid;place-items:center;background:#1f1f1f;color:#D4AF37;
                   font-weight:700;font-size:14px}
          @keyframes khoRung{
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-4px)} 40%{transform:translateX(4px)}
            60%{transform:translateX(-3px)} 80%{transform:translateX(2px)}}
          .kho-bi-tru{animation:khoRung .45s ease-in-out;
                   border-color:rgba(248,113,113,.7)!important;
                   box-shadow:0 0 0 1px rgba(248,113,113,.35),0 0 18px rgba(248,113,113,.25);
                   transition:border-color .6s,box-shadow .6s}
          .kho-so-giam{color:#f87171!important;transition:color .8s}
          #khoThongBaoBan{position:fixed;right:18px;bottom:18px;z-index:9998;
                   display:flex;flex-direction:column-reverse;gap:8px;max-width:340px}
          .kho-tb{background:rgba(20,20,20,.94);border:1px solid rgba(212,175,55,.35);
                   border-radius:12px;padding:10px 14px;color:#eee;font-size:13px;
                   box-shadow:0 8px 24px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
          .kho-tb b{color:#D4AF37}
          .kho-tb .phu{color:#9aa0a6;font-size:12px;margin-top:2px}
          @media (prefers-reduced-motion: reduce){
            .kho-bi-tru{animation:none}
          }`;
        document.head.appendChild(st);
    }

    /**
     * Cho một nguyên liệu rơi `soHat` tấm ảnh từ vị trí của phần tử gốc.
     *
     * @param {string|null} url     Ảnh nguyên liệu; null thì rơi ô chữ cái
     * @param {string}      chu     Chữ cái thay ảnh khi không có url
     * @param {DOMRect}     tuO     Hình chữ nhật xuất phát (ô ảnh trên thẻ)
     * @param {number}      soHat
     */
    static roi(url, chu, tuO, soHat = 3) {
        HieuUngRoi.caiCss();
        if (HieuUngRoi.giamChuyenDong()) return;

        for (let i = 0; i < soHat; i++) {
            if (HieuUngRoi._dangBay >= HieuUngRoi.TRAN_HAT) return;
            // Lệch giờ xuất phát giữa các hạt: rơi cùng lúc thì chúng chồng
            // khít lên nhau và trông như một tấm ảnh duy nhất.
            setTimeout(() => HieuUngRoi._motHat(url, chu, tuO), i * 85);
        }
    }

    static _motHat(url, chu, o) {
        let el;
        if (url) {
            el = document.createElement('img');
            el.src = url;
            el.alt = '';
        } else {
            el = document.createElement('div');
            el.className = 'kho-hat-chu';
            el.textContent = chu || '?';
        }
        el.classList.add('kho-hat');

        const co = 40 + Math.random() * 18;
        const x0 = o.left + o.width / 2 - co / 2 + (Math.random() - 0.5) * o.width * 0.4;
        const y0 = o.top  + o.height / 2 - co / 2;

        Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', width: co + 'px', height: co + 'px' });
        document.body.appendChild(el);
        HieuUngRoi._dangBay++;

        const roiXuong = Math.max(160, window.innerHeight - y0 + 90);  // rơi hẳn ra ngoài màn hình
        const nay      = 50 + Math.random() * 60;
        const troi     = (Math.random() * 2 - 1) * 170;
        const quay     = (Math.random() * 2 - 1) * 560;
        const thoiGian = 1150 + Math.random() * 650;

        const kf = [];
        const MOC = 12;
        for (let k = 0; k <= MOC; k++) {
            const t = k / MOC;
            const y = roiXuong * t * t - nay * Math.sin(Math.PI * t);
            kf.push({
                offset: t,
                transform: `translate(${(troi * t).toFixed(1)}px, ${y.toFixed(1)}px) ` +
                           `rotate(${(quay * t).toFixed(1)}deg) scale(${(1 - 0.18 * t).toFixed(3)})`,
                // Giữ rõ trong 3/4 quãng đường rồi mới mờ: mờ sớm thì mắt
                // không kịp nhận ra đó là tấm ảnh gì.
                opacity: t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28)
            });
        }

        const hoatAnh = el.animate(kf, { duration: thoiGian, easing: 'linear', fill: 'forwards' });

        // Dọn bằng HAI đường: khi hoạt ảnh xong, VÀ một hẹn giờ dự phòng.
        //
        // Chỉ dựa vào `onfinish` là không đủ. Khi trình duyệt ngừng vẽ —
        // cửa sổ bị che, bị thu nhỏ, gập máy — hoạt ảnh đứng yên ở khung 0
        // và `onfinish` không bao giờ tới. Đã đo được: 0 khung hình trong 1
        // giây, 16 hạt kẹt ở `currentTime = 0`. Không có đường dự phòng thì
        // hạt cứ dồn lại tới TRAN_HAT, rồi chặn luôn mọi lượt rơi sau đó —
        // hiệu ứng chết hẳn cho tới khi tải lại trang.
        //
        // `setTimeout` vẫn chạy khi trang không được vẽ (chậm hơn, nhưng vẫn
        // chạy), nên nó là thứ bảo đảm hạt nào cũng được dọn.
        let daDon = false;
        const don = () => {
            if (daDon) return;
            daDon = true;
            el.remove();
            HieuUngRoi._dangBay = Math.max(0, HieuUngRoi._dangBay - 1);
        };
        hoatAnh.onfinish = don;
        hoatAnh.oncancel = don;
        setTimeout(don, thoiGian + 500);
    }

    /** Rung và đỏ ô nguyên liệu vừa bị trừ. */
    static rungThe(the) {
        if (!the) return;
        HieuUngRoi.caiCss();
        the.classList.remove('kho-bi-tru');
        void the.offsetWidth;          // ép trình duyệt tính lại để chạy lại animation
        the.classList.add('kho-bi-tru');
        clearTimeout(the._henBoRung);
        the._henBoRung = setTimeout(() => the.classList.remove('kho-bi-tru'), 1400);
    }

    /**
     * Đếm lùi con số tồn từ giá trị cũ về giá trị mới.
     * @param {HTMLElement} el     Phần tử chứa con số
     * @param {number} tu
     * @param {number} den
     * @param {Function} dinhDang  số -> chuỗi hiển thị
     */
    static demLui(el, tu, den, dinhDang) {
        if (!el) return;
        if (HieuUngRoi.giamChuyenDong() || !Number.isFinite(tu) || tu === den) {
            el.textContent = dinhDang(den);
            return;
        }
        const batDau = performance.now();
        const TG = 750;
        el.classList.add('kho-so-giam');

        // Hủy lượt đếm cũ nếu có: hai đơn trừ cùng một nguyên liệu sát nhau
        // thì hai vòng đếm chạy chồng lên nhau, con số nhảy qua lại giữa hai
        // giá trị cho tới khi vòng nào kết thúc sau thì thắng.
        el._luotDem = (el._luotDem || 0) + 1;
        const luot = el._luotDem;

        const buoc = (bay) => {
            if (el._luotDem !== luot) return;
            const p = Math.min(1, (bay - batDau) / TG);
            const e = 1 - Math.pow(1 - p, 3);     // chậm dần về cuối
            el.textContent = dinhDang(tu + (den - tu) * e);
            if (p < 1) requestAnimationFrame(buoc);
        };
        requestAnimationFrame(buoc);

        // CON SỐ LÀ THÔNG TIN, KHÔNG PHẢI TRANG TRÍ.
        //
        // Ảnh rơi mất thì không sao. Nhưng nếu trình duyệt ngừng vẽ giữa
        // chừng (cửa sổ bị che, bị thu nhỏ) thì `requestAnimationFrame`
        // không bao giờ gọi lại, và ô tồn kho kẹt ở giá trị CŨ — màn hình
        // nói còn 6 kg trong khi sổ kho ghi 5,4 kg. Hẹn giờ này bảo đảm con
        // số luôn về đúng giá trị thật, có hoạt ảnh hay không.
        setTimeout(() => {
            if (el._luotDem !== luot) return;
            el.textContent = dinhDang(den);
            setTimeout(() => el.classList.remove('kho-so-giam'), 900);
        }, TG + 120);
    }

    /** Thông báo nhỏ ở góc dưới phải, tự tắt. */
    static thongBao(html, thoiGian = 4200) {
        HieuUngRoi.caiCss();
        let hop = document.getElementById('khoThongBaoBan');
        if (!hop) {
            hop = document.createElement('div');
            hop.id = 'khoThongBaoBan';
            document.body.appendChild(hop);
        }
        // Tối đa 4 cái: đơn tới dồn dập thì cột thông báo không được mọc
        // cao hết cả màn hình.
        while (hop.children.length >= 4) hop.firstElementChild.remove();

        const tb = document.createElement('div');
        tb.className = 'kho-tb';
        tb.innerHTML = html;
        hop.appendChild(tb);

        if (!HieuUngRoi.giamChuyenDong()) {
            tb.animate([{ opacity: 0, transform: 'translateY(12px)' },
                        { opacity: 1, transform: 'translateY(0)' }],
                       { duration: 260, easing: 'ease-out' });
        }
        setTimeout(() => {
            if (!HieuUngRoi.giamChuyenDong()) {
                tb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
            }
            // Gỡ bằng hẹn giờ, không đợi `onfinish` — cùng lý do với hạt rơi:
            // trang không được vẽ thì `onfinish` không bao giờ tới, và thông
            // báo cũ nằm lì trên màn hình.
            setTimeout(() => tb.remove(), 320);
        }, thoiGian);
    }
}
