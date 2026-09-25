import { CrudScreen } from './CrudScreen.js';
import { Formatter }  from '../core/Formatter.js';

/**
 * StaffScreen — màn hình quản lý tài khoản (bảng NHANVIEN).
 *
 * Điểm riêng so với hai màn hình kia:
 *
 *   1. Có hai tab con lọc theo vai trò: Nhân viên (quyền 1,2,3) và
 *      Khách hàng (quyền 4). Cùng một nguồn dữ liệu, chỉ khác bộ lọc.
 *   2. Chặn người dùng tự xóa tài khoản đang đăng nhập — dùng điểm mở
 *      rộng kiemTraTruocKhiXoa() của lớp cơ sở.
 *   3. Ô mật khẩu chỉ bắt buộc khi THÊM mới; khi sửa mà bỏ trống thì giữ
 *      nguyên mật khẩu cũ.
 */
export class StaffScreen extends CrudScreen {

    /** Mã quyền dành cho khách hàng — tách thành hằng để không rải số 4 khắp nơi. */
    static QUYEN_KHACH_HANG = 4;

    constructor() {
        super();
        this.boLoc = 'nhanvien';   // 'nhanvien' | 'khachhang'
    }

    get tenHienThi()       { return 'tài khoản'; }
    get endpointDanhSach() { return 'get_staff.php'; }
    get endpointGhi()      { return 'update_staff.php'; }
    get khoaChinh()        { return 'manv'; }
    get selectorBang()     { return '#staffTableBody'; }

    /** Danh sách tài khoản không ảnh hưởng đơn hàng hay thực đơn. */
    suKienSauKhiGhi() { return ['refresh_orders']; }

    /** Đổi tab con rồi vẽ lại — không cần gọi lại máy chủ. */
    doiBoLoc(boLoc) {
        this.boLoc = boLoc;
        this.ve();
    }

    /** Lọc theo tab con đang chọn. */
    _locTheoTab() {
        const laKhach = this.boLoc === 'khachhang';
        return this.duLieu.filter(tk =>
            laKhach
                ? Number(tk.MAQUYEN) === StaffScreen.QUYEN_KHACH_HANG
                : Number(tk.MAQUYEN) !== StaffScreen.QUYEN_KHACH_HANG
        );
    }

    cotBang() { return []; }   // màn hình này tự vẽ dòng bảng

    /**
     * Ghi đè ve() vì danh sách hiển thị là TẬP CON đã lọc, chứ không phải
     * toàn bộ dữ liệu như mặc định của lớp cơ sở.
     */
    ve() {
        const khung = document.querySelector(this.selectorBang);
        if (!khung) return;
        const danhSach = this._locTheoTab();
        khung.innerHTML = danhSach.length ? this.veNoiDung(danhSach) : this.htmlRong();
    }

    htmlRong() {
        const thongBao = this.boLoc === 'khachhang'
            ? 'Chưa có tài khoản khách hàng nào'
            : 'Chưa có tài khoản nhân viên nào';
        return `<tr><td colspan="5" class="py-6 text-center text-slate-500">${thongBao}</td></tr>`;
    }

    /** Màu nhãn vai trò — gom vào một chỗ thay vì lồng ba tầng toán tử ba ngôi. */
    static _mauVaiTro(maQuyen) {
        const bang = {
            1: 'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20',
            3: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            4: 'text-yellow-500 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
        };
        return bang[Number(maQuyen)]
            || 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
    }

    veNoiDung(danhSach) {
        return danhSach.map(tk => {
            const id = Formatter.an(tk.MANV);
            const mau = StaffScreen._mauVaiTro(tk.MAQUYEN);
            const tenVaiTro = Number(tk.MAQUYEN) === StaffScreen.QUYEN_KHACH_HANG
                ? 'Khách hàng' : Formatter.an(tk.TENQUYEN);

            return `
                <tr class="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800 dark:text-white text-sm">${Formatter.an(tk.HOTENNV)}</td>
                    <td class="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs">${Formatter.an(tk.TENDN)}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border ${mau}">${tenVaiTro}</span>
                    </td>
                    <td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium text-xs">
                        <div><i class="fa-solid fa-phone mr-1.5 text-slate-400"></i>${Formatter.an(tk.SDT) || 'Chưa cập nhật'}</div>
                        <div class="mt-1"><i class="fa-solid fa-envelope mr-1.5 text-slate-400"></i>${Formatter.an(tk.EMAIL) || 'Chưa cập nhật'}</div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end space-x-2">
                            <button class="nut-sua p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-gold hover:text-gold text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm"
                                    data-id="${id}" title="Sửa"><i class="fa-solid fa-user-pen"></i></button>
                            <button class="nut-xoa p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 hover:text-red-500 text-slate-500 dark:text-slate-400 transition-all text-xs shadow-sm"
                                    data-id="${id}" title="Xóa"><i class="fa-solid fa-user-xmark"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    truongForm(banGhi) {
        const laThemMoi = !banGhi;
        return [
            { ten: 'hoten', nhan: 'Họ và tên', kieu: 'text', batBuoc: true,
              giaTri: banGhi ? banGhi.HOTENNV : '' },

            { ten: 'tendn', nhan: 'Tên đăng nhập', kieu: 'text', batBuoc: true,
              giaTri: banGhi ? banGhi.TENDN : '',
              kiemTra: (v) => /\s/.test(v) ? 'Tên đăng nhập không được chứa khoảng trắng' : null },

            { ten: 'matkhau',
              nhan: laThemMoi ? 'Mật khẩu' : 'Mật khẩu mới (bỏ trống nếu giữ nguyên)',
              kieu: 'password',
              batBuoc: laThemMoi,
              giaTri: '',
              kiemTra: (v) => (v && v.length < 6) ? 'Mật khẩu phải từ 6 ký tự trở lên' : null },

            { ten: 'email', nhan: 'Email', kieu: 'email',
              giaTri: banGhi ? banGhi.EMAIL : '',
              kiemTra: (v) => (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) ? 'Email không hợp lệ' : null },

            { ten: 'sdt', nhan: 'Số điện thoại', kieu: 'text',
              giaTri: banGhi ? banGhi.SDT : '',
              kiemTra: (v) => (v && !/^0\d{9}$/.test(v.replace(/\s/g, '')))
                              ? 'Số điện thoại cần 10 chữ số, bắt đầu bằng 0' : null },

            { ten: 'gioitinh', nhan: 'Giới tính', kieu: 'select',
              giaTri: banGhi ? banGhi.GIOITINH : 'Nam',
              tuyChon: [
                  { giaTri: 'Nam', nhan: 'Nam' },
                  { giaTri: 'Nữ',  nhan: 'Nữ' },
                  { giaTri: 'Khác', nhan: 'Khác' }
              ] },

            { ten: 'ngaysinh', nhan: 'Ngày sinh', kieu: 'date',
              giaTri: banGhi ? banGhi.NGAYSINH : '' },

            { ten: 'maquyen', nhan: 'Vai trò', kieu: 'select',
              giaTri: banGhi ? banGhi.MAQUYEN : 2,
              tuyChon: [
                  { giaTri: 1, nhan: 'Quản lý' },
                  { giaTri: 2, nhan: 'Nhân viên' },
                  { giaTri: 3, nhan: 'Thu ngân' },
                  { giaTri: 4, nhan: 'Khách hàng' }
              ] }
        ];
    }

    /**
     * Chặn tự xóa chính mình.
     *
     * Không có bước này, người quản lý duy nhất có thể xóa tài khoản của
     * chính họ và không ai còn quyền vào trang quản trị nữa.
     */
    kiemTraTruocKhiXoa(banGhi) {
        let manvHienTai = null;
        try { manvHienTai = localStorage.getItem('manv'); } catch (e) { /* bỏ qua */ }

        if (manvHienTai && String(banGhi.MANV) === String(manvHienTai)) {
            return 'Bạn không thể xóa tài khoản đang đăng nhập.';
        }
        return null;
    }

    canhBaoXoa() {
        // Máy chủ chỉ xóa tài khoản chưa có lịch sử (QĐ-096): đơn hàng, phiếu
        // đặt, mã giảm giá, điểm, hội thoại, phiếu kho. Trước đây xóa khách là
        // CASCADE mất sạch những thứ đó mà không hỏi.
        return 'Chỉ xóa được tài khoản chưa có đơn hàng, phiếu đặt bàn, mã giảm giá hay lịch sử nào (tạo nhầm). '
             + 'Tài khoản đã có lịch sử sẽ được giữ lại và máy chủ báo rõ lý do.';
    }

    /** Bỏ trống ô mật khẩu khi sửa thì không gửi lên, máy chủ giữ mật khẩu cũ. */
    async chuanBiDuLieuGui(duLieuForm) {
        const goiTin = { ...duLieuForm };
        if (goiTin.action === 'edit' && !goiTin.matkhau) {
            delete goiTin.matkhau;
        }
        return goiTin;
    }
}
