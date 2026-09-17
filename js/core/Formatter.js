/**
 * Formatter — định dạng hiển thị dùng chung.
 *
 * Gom lại một chỗ để cách hiển thị tiền và thời gian giống nhau trên mọi
 * màn hình. Trước đây mỗi nơi tự gọi toLocaleString với tham số hơi khác
 * nhau, nên cùng một số tiền lại hiện khác kiểu tùy màn hình.
 */
export class Formatter {

    /** 55000 -> "55.000" */
    static tien(giaTri) {
        const so = parseInt(giaTri, 10);
        return Number.isFinite(so) ? so.toLocaleString('vi-VN') : '0';
    }

    /** 55000 -> "55.000 ₫" */
    static tienCoDonVi(giaTri) {
        return Formatter.tien(giaTri) + ' ₫';
    }

    /**
     * "2026-09-11 15:12:05" -> "15:12"
     *
     * Viết phòng thủ thay vì chuỗi.split(' ')[1].substring(0,5) như code cũ:
     * nếu chuỗi không chứa dấu cách thì phần tử [1] là undefined và
     * .substring() sẽ ném TypeError ngay giữa vòng lặp dựng giao diện,
     * làm hỏng toàn bộ phần render mà không có thông báo nào trên màn hình.
     * Chính lớp lỗi đó từng khiến danh sách đơn của thu ngân trắng trơn —
     * xem QĐ-013.
     */
    static gioPhut(chuoiThoiGian) {
        if (!chuoiThoiGian || typeof chuoiThoiGian !== 'string') return '--:--';
        const phan = chuoiThoiGian.split(' ');
        if (phan.length < 2 || !phan[1]) return '--:--';
        return phan[1].substring(0, 5);
    }

    /** "2026-09-11 15:12:05" -> "11/09/2026" */
    static ngay(chuoiThoiGian) {
        if (!chuoiThoiGian || typeof chuoiThoiGian !== 'string') return '--/--/----';
        const ngayGio = chuoiThoiGian.split(' ')[0];
        const phan = ngayGio.split('-');
        return phan.length === 3 ? `${phan[2]}/${phan[1]}/${phan[0]}` : ngayGio;
    }

    /** Hôm nay theo định dạng YYYY-MM-DD (giờ địa phương, không dùng UTC). */
    static homNay() {
        const d = new Date();
        const thang = String(d.getMonth() + 1).padStart(2, '0');
        const ngay = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${thang}-${ngay}`;
    }

    /**
     * Chống XSS khi chèn dữ liệu người dùng vào chuỗi HTML.
     * Tên món, tên nhân viên đều do người dùng nhập, nên nếu nối thẳng vào
     * innerHTML thì một tên chứa thẻ script sẽ được trình duyệt thực thi.
     */
    static an(chuoi) {
        if (chuoi === null || chuoi === undefined) return '';
        return String(chuoi)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
