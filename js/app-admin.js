/**
 * app-admin.js — điểm khởi động cho phần trang quản trị đã chuyển sang
 * kiến trúc hướng đối tượng.
 *
 * TRẠNG THÁI CHUYỂN ĐỔI
 * ---------------------
 * Ba màn hình quản lý danh sách — Danh mục, Món ăn, Tài khoản — đều đã
 * chạy trên lớp cơ sở CrudScreen. Phần còn lại trong js/admin.js là
 * Tổng quan (biểu đồ), Landing Page, thông báo đơn hàng và đăng xuất;
 * những phần đó không phải CRUD danh sách nên chưa chuyển.
 *
 * Hai bên trao đổi bằng sự kiện DOM tùy biến, vì admin.js là script
 * thường còn tệp này là ES module — chúng không thấy phạm vi của nhau:
 *
 *   admin.js --[ admin:mo-tab-thuc-don  ]--> tệp này
 *   admin.js --[ admin:mo-tab-nhan-vien ]--> tệp này
 *   tệp này  --[ admin:socket-phat      ]--> admin.js  (nhờ phát socket)
 *
 * Cây cầu socket còn tồn tại vì admin.js vẫn giữ kết nối riêng cho phần
 * thông báo đơn hàng. Nếu để SocketBus tự kết nối nữa thì một trang sẽ có
 * hai socket tới cùng máy chủ.
 */
import { ApiClient }      from './core/ApiClient.js';
import { SocketBus }      from './core/SocketBus.js';
import { CategoryScreen } from './screens/CategoryScreen.js';
import { DishScreen }     from './screens/DishScreen.js';
import { StaffScreen }    from './screens/StaffScreen.js';
import { TableScreen }    from './screens/TableScreen.js';
import { BookingScreen }  from './screens/BookingScreen.js';
import { VoucherScreen }  from './screens/VoucherScreen.js';
import { ChatScreen }     from './screens/ChatScreen.js';

/* ------------------------------------------------------------------ */
/* Khởi tạo các màn hình                                               */
/* ------------------------------------------------------------------ */

const manHinhMon = new DishScreen();

// Chọn một danh mục thì lọc bảng món theo danh mục đó.
// Hai màn hình nói chuyện trực tiếp với nhau, không cần qua admin.js nữa.
const manHinhDanhMuc = new CategoryScreen((danhMuc) => {
    manHinhMon.locTheoDanhMuc(danhMuc);
});

const manHinhTaiKhoan = new StaffScreen();

// Hai màn hình bổ sung — trước đây web quản trị hoàn toàn không có, buộc
// người quản lý phải mở ứng dụng trên điện thoại dù đang ngồi máy tính.
const manHinhBanAn  = new TableScreen();
const manHinhDatBan = new BookingScreen();
const manHinhVoucher = new VoucherScreen();
const manHinhChat    = new ChatScreen();

/* ------------------------------------------------------------------ */
/* Tab Thực đơn — gồm Danh mục và Món ăn                               */
/* ------------------------------------------------------------------ */

let daKhoiDongThucDon = false;

document.addEventListener('admin:mo-tab-thuc-don', async () => {
    if (!daKhoiDongThucDon) {
        // Món ăn khởi động trước để sẵn sàng nhận lệnh lọc mà
        // CategoryScreen phát ra ngay khi tự chọn danh mục đầu tiên.
        await manHinhMon.khoiDong();
        await manHinhDanhMuc.khoiDong();
        daKhoiDongThucDon = true;
    } else {
        await manHinhDanhMuc.nap();
    }

    // Biểu mẫu món ăn cần danh sách danh mục để đổ vào ô chọn
    manHinhMon.capNhatDanhSachLoai(manHinhDanhMuc.duLieu);
});

/* ------------------------------------------------------------------ */
/* Tab Nhân viên                                                        */
/* ------------------------------------------------------------------ */

let daKhoiDongTaiKhoan = false;

document.addEventListener('admin:mo-tab-nhan-vien', async () => {
    if (!daKhoiDongTaiKhoan) {
        await manHinhTaiKhoan.khoiDong();
        daKhoiDongTaiKhoan = true;
    } else {
        await manHinhTaiKhoan.nap();
    }
});

/* ------------------------------------------------------------------ */
/* Tab Bàn ăn                                                           */
/* ------------------------------------------------------------------ */

let daKhoiDongBanAn = false;

document.addEventListener('admin:mo-tab-ban-an', async () => {
    if (!daKhoiDongBanAn) {
        await manHinhBanAn.khoiDong();
        daKhoiDongBanAn = true;
    } else {
        await manHinhBanAn.nap();
    }
});

/* ------------------------------------------------------------------ */
/* Tab Đặt bàn                                                          */
/* ------------------------------------------------------------------ */

let daKhoiDongDatBan = false;

/**
 * Tab Voucher.
 *
 * Cùng khuôn với các tab khác: nạp lần đầu rồi thôi. Lần sau quay lại,
 * dữ liệu vẫn còn — bấm sửa/xóa/bật-tắt đều tự nạp lại nên không cần
 * tải lại mỗi lần mở tab.
 */
document.addEventListener('admin:mo-tab-voucher', async () => {
    try {
        await manHinhVoucher.khoiDong();
    } catch (e) {
        console.error('Không khởi động được màn hình voucher:', e);
    }
}, { once: true });

document.addEventListener('admin:mo-tab-dat-ban', async () => {
    if (!daKhoiDongDatBan) {
        await manHinhDatBan.khoiDong();
        daKhoiDongDatBan = true;
    } else {
        await manHinhDatBan.nap();
    }
});

/* ------------------------------------------------------------------ */
/* Tab Chăm sóc khách hàng                                             */
/* ------------------------------------------------------------------ */

let daKhoiDongChat = false;

document.addEventListener('admin:mo-tab-chat', async () => {
    try {
        if (!daKhoiDongChat) {
            await manHinhChat.khoiDong();
            daKhoiDongChat = true;
        } else {
            await manHinhChat.moLai();
        }
    } catch (e) {
        console.error('Không mở được hộp thư chăm sóc khách hàng:', e);
    }
});

// Rời tab thì dừng vòng hỏi lại. Huy hiệu bên thanh điều hướng vẫn cập nhật
// nhờ sự kiện socket, nên tắt vòng hỏi ở đây không làm mất thông báo.
document.addEventListener('admin:roi-tab', (e) => {
    if (e.detail === 'chat') manHinhChat.tamDung();
});

/* ------------------------------------------------------------------ */
/* Huy hiệu "đang chờ" — chạy kể cả khi tab chat đóng                  */
/* ------------------------------------------------------------------ */
//
// Đây mới là phần khiến tính năng dùng được thật. Không có nó, nhân viên chỉ
// biết có người đang đợi NẾU họ chủ động mở tab chat lên xem — mà lý do duy
// nhất để mở tab lại chính là biết có người đang đợi.

async function capNhatHuyHieuCho() {
    try {
        const kq = await ApiClient.layDanhSach('chat_nhan_vien.php', { limit: 1 });
        const o = document.getElementById('navChatHuyHieu');
        if (!o) return;
        const n = kq.so_cho || 0;
        if (n > 0) {
            o.textContent = n > 9 ? '9+' : String(n);
            o.classList.remove('hidden');
        } else {
            o.classList.add('hidden');
        }
    } catch (e) {
        // Im lặng: đây là chỉ báo phụ, không đáng làm phiền người dùng khi
        // mạng chớp một nhịp.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    capNhatHuyHieuCho();

    // Socket là đường chính. Hỏi lại mỗi 60 giây chỉ để bù cho lúc socket
    // đứt — thưa hơn hẳn vòng trong tab vì ở đây chỉ cần một con số.
    SocketBus.nghe('chat_moi', capNhatHuyHieuCho);
    setInterval(capNhatHuyHieuCho, 60000);
});

/* ------------------------------------------------------------------ */
/* Gắn nút bấm                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {

    ganClick('btnAddCategory', () => manHinhDanhMuc.moFormThem());

    ganClick('btnAddDish', () => {
        // Đồng bộ danh sách danh mục trước khi mở biểu mẫu, phòng khi
        // người dùng vừa thêm một danh mục mới
        manHinhMon.capNhatDanhSachLoai(manHinhDanhMuc.duLieu);
        manHinhMon.moFormThem();
    });

    ganClick('btnCreateStaff', () => manHinhTaiKhoan.moFormThem());
    ganClick('btnAddTable',    () => manHinhBanAn.moFormThem());

    // Bộ lọc trạng thái phiếu đặt bàn — cùng một nguồn dữ liệu, chỉ đổi bộ lọc
    document.querySelectorAll('.loc-dat-ban').forEach(nut => {
        nut.addEventListener('click', () => {
            manHinhDatBan.doiBoLoc(nut.dataset.loc);
            document.querySelectorAll('.loc-dat-ban').forEach(k => {
                const dangChon = k === nut;
                k.classList.toggle('border-gold-400', dangChon);
                k.classList.toggle('text-gold-400', dangChon);
                k.classList.toggle('border-transparent', !dangChon);
                k.classList.toggle('text-gray-400', !dangChon);
            });
        });
    });

    // Hai tab con lọc theo vai trò, cùng một nguồn dữ liệu
    ganClick('btnThemVoucher', () => manHinhVoucher.moFormThem());

    // Bộ lọc trạng thái hội thoại
    document.querySelectorAll('.loc-chat').forEach(nut => {
        nut.addEventListener('click', () => {
            manHinhChat.doiBoLoc(nut.dataset.loc);
            document.querySelectorAll('.loc-chat').forEach(k => {
                const dangChon = k === nut;
                k.classList.toggle('border-gold-400', dangChon);
                k.classList.toggle('text-gold-400', dangChon);
                k.classList.toggle('border-transparent', !dangChon);
                k.classList.toggle('text-gray-400', !dangChon);
            });
        });
    });

    ganClick('tabFilterStaff', () => {
        manHinhTaiKhoan.doiBoLoc('nhanvien');
        doiKieuTabCon('tabFilterStaff', 'tabFilterCustomer');
    });

    ganClick('tabFilterCustomer', () => {
        manHinhTaiKhoan.doiBoLoc('khachhang');
        doiKieuTabCon('tabFilterCustomer', 'tabFilterStaff');
    });
});

function ganClick(id, xuLy) {
    const o = document.getElementById(id);
    if (o) o.addEventListener('click', xuLy);
}

/** Chuyển kiểu hiển thị giữa hai tab con Nhân viên / Khách hàng. */
function doiKieuTabCon(idDangChon, idConLai) {
    const dangChon = document.getElementById(idDangChon);
    const conLai   = document.getElementById(idConLai);
    if (dangChon) {
        dangChon.classList.add('border-gold-400', 'text-gold-400');
        dangChon.classList.remove('border-transparent', 'text-gray-400');
    }
    if (conLai) {
        conLai.classList.remove('border-gold-400', 'text-gold-400');
        conLai.classList.add('border-transparent', 'text-gray-400');
    }
}

// Hữu ích khi gỡ lỗi từ Console của trình duyệt
window.__manHinh = {
    danhMuc: manHinhDanhMuc,
    mon: manHinhMon,
    taiKhoan: manHinhTaiKhoan,
    banAn: manHinhBanAn,
    datBan: manHinhDatBan,
    voucher: manHinhVoucher,
    chat: manHinhChat
};
