/* ==========================================================================
   ROYAL RESTAURANT — LANDING PAGE MAIN JS ECOSYSTEM
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initGoldParticles();
    initNavbar();
    initMobileMenu();
    initScrollAnimations();
    napThucDon();          // nap thuc don tu API (bat dong bo)
    initBookingForm();
    initSmoothScroll();
});

/* --- Ambient Gold Particle Background Generator --- */
function initGoldParticles() {
    const container = document.getElementById('goldParticles');
    if (!container) return;
    container.innerHTML = '';
    const count = 35;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 15 + 10}s`;
        p.style.animationDelay = `${Math.random() * 10}s`;
        p.style.opacity = Math.random() * 0.7 + 0.3;
        container.appendChild(p);
    }
}

/* --- Navbar Scroll Effect --- */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active link on scroll
        let current = '';
        const sections = document.querySelectorAll('section, header');
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

/* --- Mobile Menu Toggle --- */
function initMobileMenu() {
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener('click', () => {
            mobileMenu.classList.add('open');
        });
    }

    if (closeMobileMenu && mobileMenu) {
        closeMobileMenu.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
        });
    }

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.remove('open');
        });
    });
}

/* --- Scroll Animation Observer --- */
function initScrollAnimations() {
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    
    // Make elements visible immediately if observer supported
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.05 });

        animateElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        animateElements.forEach(el => el.classList.add('visible'));
    }
}

/* ==========================================================================
   THỰC ĐƠN — NẠP TỪ REST API
   ==========================================================================
   Trước đây phần này là một mảng `sampleMenuData` gồm 35 món ghi cứng ngay
   trong tệp: tên, giá, mô tả, nhãn đều do người viết tự đặt. Hệ quả là
   thực đơn công khai không liên quan gì tới cơ sở dữ liệu — quản lý sửa
   giá hay tắt món trong trang quản trị thì trang khách vẫn hiển thị số cũ.
   Với một trang giới thiệu nhà hàng, hiển thị sai giá là vấn đề nghiệp vụ
   thật chứ không chỉ là lỗi kỹ thuật.

   Nay dữ liệu lấy trực tiếp từ hai endpoint công khai:
       /api/api/get_categories.php
       /api/api/get_dishes.php
   Cả hai được để ở nhóm công khai có chủ đích khi siết xác thực (QĐ-022),
   chính là để trang này gọi được khi khách chưa đăng nhập.

   LƯU Ý VỀ NỘI DUNG BỊ LƯỢC BỎ
   ----------------------------
   Mảng cũ có thêm mô tả món và nhãn ("Best Seller", "Đặc Sản"...) mà cơ sở
   dữ liệu không lưu. Tôi cố ý KHÔNG bịa lại những nội dung đó: một dòng mô
   tả sai còn tệ hơn là không có mô tả. Nếu muốn có, cần bổ sung cột MOTA
   vào bảng MON và cho quản lý nhập từ trang quản trị.
   ========================================================================== */

// Apache chuyển tiếp /api/ sang container REST API, cùng origin nên không
// vướng CORS. Cách ghép đường dẫn giữ đúng quy ước chung của dự án
// (BASE_URL + "api/<tên tệp>.php") — xem QĐ-011.
const API_GOC = '/api/';

let danhSachMon  = [];   // các món đang còn bán
let danhSachLoai = [];   // danh mục thực đơn

/** Ghép đường dẫn ảnh: Cloudinary trả URL đầy đủ, dữ liệu cũ chỉ có tên tệp. */
function duongDanAnh(hinhAnh) {
    if (!hinhAnh) return 'images/hero.png';
    return /^https?:\/\//i.test(hinhAnh) ? hinhAnh : ('/images/' + hinhAnh);
}

function dinhDangTien(giaTri) {
    const so = parseInt(giaTri, 10);
    return Number.isFinite(so) ? so.toLocaleString('vi-VN') : '—';
}

async function napThucDon() {
    const luoi = document.getElementById('menuGrid');
    if (luoi) {
        luoi.innerHTML = '<p class="menu-trang-thai">Đang tải thực đơn…</p>';
    }
    try {
        const [phanHoiLoai, phanHoiMon] = await Promise.all([
            fetch(API_GOC + 'api/get_categories.php'),
            fetch(API_GOC + 'api/get_dishes.php')
        ]);
        if (!phanHoiLoai.ok || !phanHoiMon.ok) throw new Error('HTTP lỗi');

        const loai = await phanHoiLoai.json();
        const mon  = await phanHoiMon.json();

        danhSachLoai = Array.isArray(loai) ? loai : [];

        // Chỉ hiển thị món CÒN BÁN. Quảng cáo một món đã hết là cách nhanh
        // nhất để khách tới nơi rồi thất vọng.
        danhSachMon = (mon && Array.isArray(mon.data) ? mon.data : [])
            .filter(m => String(m.TINHTRANG) === 'true');

        renderMenuCategories();
        renderMenuItems('all');
        renderMarqueeFood();
    } catch (loi) {
        console.error('Không nạp được thực đơn:', loi);
        if (luoi) {
            luoi.innerHTML =
                '<p class="menu-trang-thai">Không tải được thực đơn. ' +
                'Vui lòng thử lại hoặc liên hệ nhà hàng qua hotline.</p>';
        }
    }
}

function renderMarqueeFood() {
    const track1 = document.getElementById('marqueeTrack1');
    const track2 = document.getElementById('marqueeTrack2');
    if (!track1 || !track2 || danhSachMon.length === 0) return;

    const noiBat = danhSachMon.slice(0, 16);
    const html = noiBat.map(m => `
            <div class="food-marquee-card">
                <img src="${duongDanAnh(m.HINHANH)}" alt="${m.TENMON}" loading="lazy"
                     onerror="this.src='images/hero.png'">
                <div class="card-info">
                    <h4>${m.TENMON}</h4>
                    <span class="price">${dinhDangTien(m.GIATIEN)} VNĐ</span>
                </div>
            </div>`).join('');

    track1.innerHTML = html;
    track2.innerHTML = html;
}

function renderMenuCategories() {
    const khung = document.getElementById('menuCategories');
    if (!khung) return;

    // Biểu tượng gán theo mã danh mục; danh mục mới sẽ dùng biểu tượng mặc định.
    const BIEU_TUONG = {
        1: 'fa-bowl-food',    // Bữa Sáng
        2: 'fa-sun',          // Cơm Trưa
        3: 'fa-moon',         // Cơm Tối
        4: 'fa-ice-cream',    // Đồ Ngọt
        5: 'fa-glass-water'   // Thức Uống
    };

    const muc = [{ id: 'all', ten: `Tất Cả Món (${danhSachMon.length})`, icon: 'fa-utensils' }]
        .concat(danhSachLoai.map(l => ({
            id: String(l.MALOAI),
            ten: l.TENLOAI,
            icon: BIEU_TUONG[l.MALOAI] || 'fa-utensils'
        })));

    khung.innerHTML = muc.map((c, i) => `
        <button class="cat-btn ${i === 0 ? 'active' : ''}" data-cat="${c.id}">
            <i class="fa-solid ${c.icon}"></i> ${c.ten}
        </button>`).join('');

    khung.querySelectorAll('.cat-btn').forEach(nut => {
        nut.addEventListener('click', function () {
            khung.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderMenuItems(this.getAttribute('data-cat'));
        });
    });
}

function renderMenuItems(maLoai = 'all') {
    const luoi = document.getElementById('menuGrid');
    if (!luoi) return;

    const loc = maLoai === 'all'
        ? danhSachMon
        : danhSachMon.filter(m => String(m.MALOAI) === String(maLoai));

    if (loc.length === 0) {
        luoi.innerHTML = '<p class="menu-trang-thai">Danh mục này hiện chưa có món nào.</p>';
        return;
    }

    const tenLoaiTheoMa = {};
    danhSachLoai.forEach(l => { tenLoaiTheoMa[String(l.MALOAI)] = l.TENLOAI; });

    luoi.innerHTML = loc.map(m => `
        <div class="menu-card animate-on-scroll visible">
            <div class="menu-card-img">
                <img src="${duongDanAnh(m.HINHANH)}" alt="${m.TENMON}" loading="lazy"
                     onerror="this.src='images/hero.png'">
            </div>
            <div class="menu-card-body">
                <div class="menu-card-header">
                    <h4>${m.TENMON}</h4>
                    <span class="price">${dinhDangTien(m.GIATIEN)}đ</span>
                </div>
                <div class="menu-card-footer">
                    <span class="cat-tag"><i class="fa-solid fa-tag"></i> ${tenLoaiTheoMa[String(m.MALOAI)] || 'Món ăn'}</span>
                    <button class="order-btn" onclick="quickBook('${String(m.TENMON).replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-cart-plus"></i> Đặt Ngay
                    </button>
                </div>
            </div>
        </div>`).join('');
}


function quickBook(itemName) {
    const noteField = document.getElementById('bookingNote');
    if (noteField) {
        noteField.value = `Đặt món: ${itemName}`;
    }
    const resSection = document.getElementById('reservation');
    if (resSection) {
        resSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/* ==========================================================================
   BIỂU MẪU ĐẶT BÀN — GỬI THẬT LÊN MÁY CHỦ
   ==========================================================================
   Trước đây hàm này chỉ hiển thị hộp thoại "Đặt Bàn Thành Công!" rồi gọi
   form.reset(). Không có một lời gọi mạng nào — yêu cầu của khách biến mất
   ngay tại trình duyệt. Đây là khoảng cách lớn nhất giữa vẻ ngoài và thực
   chất của trang này.

   Nay gửi tới endpoint công khai /api/api/dat_ban_khach.php. Khách vãng lai
   không cần tài khoản: thông tin liên hệ lưu thẳng trên phiếu đặt bàn, và
   hệ thống tự xếp một bàn còn trống trong khung giờ đó.
   ========================================================================== */
function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    const oNgay = document.getElementById('bookingDate');
    if (oNgay) {
        const homNay = new Date().toISOString().split('T')[0];
        oNgay.value = homNay;
        oNgay.min   = homNay;   // không cho chọn ngày quá khứ ngay tại giao diện
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const nut = form.querySelector('button[type="submit"]');
        const nhanGoc = nut ? nut.innerHTML : '';

        const duLieu = new URLSearchParams({
            tenkhach: document.getElementById('bookingName').value.trim(),
            sdtkhach: document.getElementById('bookingPhone').value.trim(),
            ngay:     document.getElementById('bookingDate').value,
            gio:      document.getElementById('bookingTime').value,
            sokhach:  document.getElementById('bookingGuests').value,
            ghichu:   (document.getElementById('bookingNote') || {}).value || ''
        });

        // Khóa nút trong lúc gửi: chống nhấn liên tiếp tạo nhiều phiếu trùng.
        if (nut) {
            nut.disabled = true;
            nut.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
        }

        try {
            const phanHoi = await fetch(API_GOC + 'api/dat_ban_khach.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: duLieu.toString()
            });
            const kq = await phanHoi.json();

            if (kq.status === 'success') {
                thongBao('success', 'Đặt Bàn Thành Công!',
                    `<div style="text-align:left;line-height:1.9">
                        <p><strong>Mã phiếu:</strong> #${kq.MADATBAN}</p>
                        <p><strong>Bàn:</strong> ${kq.TENBAN}</p>
                        <p><strong>Thời gian:</strong> ${kq.THOIGIANHEN}</p>
                     </div>
                     <p style="margin-top:14px">${kq.message}</p>`);
                form.reset();
                if (oNgay) oNgay.value = new Date().toISOString().split('T')[0];
            } else {
                // Thông báo từ máy chủ đã viết sẵn bằng tiếng Việt dễ hiểu
                // (kín bàn, ngoài giờ mở cửa, vượt giới hạn đặt trong ngày…)
                thongBao('warning', 'Chưa đặt được bàn', kq.message || 'Vui lòng thử lại.');
            }
        } catch (loi) {
            console.error('Lỗi gửi yêu cầu đặt bàn:', loi);
            thongBao('error', 'Không kết nối được máy chủ',
                'Vui lòng kiểm tra kết nối mạng hoặc gọi hotline để đặt bàn trực tiếp.');
        } finally {
            if (nut) { nut.disabled = false; nut.innerHTML = nhanGoc; }
        }
    });
}

/** Hộp thoại thông báo, có đường lui khi thư viện SweetAlert2 không tải được. */
function thongBao(kieu, tieuDe, noiDungHtml) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: kieu,
            title: tieuDe,
            html: noiDungHtml,
            confirmButtonColor: '#D4AF37',
            confirmButtonText: 'Đóng'
        });
    } else {
        const xuongDong = String.fromCharCode(10, 10);
        alert(tieuDe + xuongDong + String(noiDungHtml).replace(/<[^>]*>/g, ' '));
    }
}

/* --- Smooth Scrolling --- */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}
