/**
 * ApiClient — lớp gọi REST API dùng chung cho toàn bộ web quản trị.
 *
 * VÌ SAO CÓ LỚP NÀY
 * -----------------
 * Trước đây mỗi chỗ cần gọi API đều viết lại nguyên khối $.ajax:
 *
 *     $.ajax({ url: CONFIG.BASE_URL + "api/update_category.php",
 *              type: "POST", data: {...}, dataType: "json",
 *              success: function(res) { ... }, error: ... });
 *
 * Riêng admin.js có hơn 20 khối như vậy. Hệ quả là ba việc — ghép đường
 * dẫn, đính thông tin phiên, xử lý lỗi — bị lặp lại ở hơn 20 nơi, và chỉ
 * cần sửa một quy ước là phải sửa cả 20.
 *
 * Lớp này gom cả ba vào một chỗ và trả về Promise, nên dùng được với
 * async/await thay cho callback lồng nhau.
 *
 * GHI CHÚ VỀ ĐƯỜNG DẪN
 * --------------------
 * Đường dẫn cuối cùng là  "/api/" + "api/<tên tệp>.php".
 * Chữ "api" lặp hai lần là CỐ Ý, không phải lỗi: Apache cắt bỏ tiền tố
 * "/api/" rồi chuyển phần còn lại về gốc container REST API. Ứng dụng
 * Android cũng ghép y hệt. Xem _nangcap/02_NHAT_KY_QUYET_DINH.md, QĐ-011.
 */
export class ApiClient {

    /** Tiền tố mà Apache dùng để nhận diện và chuyển tiếp yêu cầu API. */
    static TIEN_TO = '/api/';

    /**
     * Đọc thông tin phiên từ localStorage.
     * Bọc trong try/catch vì trình duyệt ở chế độ ẩn danh có thể chặn.
     */
    static _thongTinPhien() {
        try {
            return {
                manv: localStorage.getItem('manv'),
                token: localStorage.getItem('token')
            };
        } catch (e) {
            return { manv: null, token: null };
        }
    }

    /**
     * Gọi một endpoint.
     *
     * @param {string} tep      Tên tệp PHP, ví dụ 'get_categories.php'
     * @param {object} tuyChon  { method, duLieu, thamSo }
     * @returns {Promise<any>}  Dữ liệu JSON đã giải mã
     * @throws  {LoiApi}        Khi HTTP lỗi hoặc máy chủ trả status=error
     */
    static async goi(tep, { method = 'GET', duLieu = null, thamSo = null } = {}) {
        let url = ApiClient.TIEN_TO + 'api/' + tep;

        if (thamSo && Object.keys(thamSo).length) {
            url += '?' + new URLSearchParams(thamSo).toString();
        }

        const tuyChonFetch = { method, headers: {} };

        // Đính thông tin phiên. Máy chủ đọc hai header này trong
        // api/require_auth.php — xem QĐ-020.
        const { manv, token } = ApiClient._thongTinPhien();
        if (manv && token) {
            tuyChonFetch.headers['X-Manv'] = manv;
            tuyChonFetch.headers['X-Token'] = token;
        }

        if (duLieu) {
            // Dùng form-urlencoded chứ không phải JSON: toàn bộ endpoint PHP
            // hiện đọc dữ liệu qua $_POST, vốn chỉ điền sẵn với kiểu này.
            tuyChonFetch.headers['Content-Type'] =
                'application/x-www-form-urlencoded; charset=UTF-8';
            tuyChonFetch.body = new URLSearchParams(duLieu).toString();
        }

        let phanHoi;
        try {
            phanHoi = await fetch(url, tuyChonFetch);
        } catch (e) {
            throw new LoiApi('Không kết nối được máy chủ. Kiểm tra lại mạng.', 0);
        }

        // Phiên hết hiệu lực: xử lý tập trung tại đây thay vì để từng màn
        // hình tự đoán. Không bắt ở đây thì mọi lời gọi sẽ lặng lẽ thất bại
        // và giao diện chỉ hiện dữ liệu trống, người dùng không hiểu vì sao.
        if (phanHoi.status === 401) {
            ApiClient._xuLyHetPhien();
            throw new LoiApi('Phiên đăng nhập đã hết hạn.', 401);
        }

        if (phanHoi.status === 403) {
            throw new LoiApi('Tài khoản của bạn không có quyền thực hiện thao tác này.', 403);
        }

        const chuoi = await phanHoi.text();
        let ketQua;
        try {
            ketQua = JSON.parse(chuoi);
        } catch (e) {
            // Máy chủ trả về HTML (thường là lỗi PHP) thay vì JSON
            console.error('[ApiClient] Phản hồi không phải JSON từ ' + tep + ':', chuoi.slice(0, 200));
            throw new LoiApi('Máy chủ trả về dữ liệu không hợp lệ.', phanHoi.status);
        }

        if (ketQua && ketQua.status === 'error') {
            throw new LoiApi(ketQua.message || 'Thao tác thất bại.', phanHoi.status);
        }

        return ketQua;
    }

    static layDanhSach(tep, thamSo = null) {
        return ApiClient.goi(tep, { method: 'GET', thamSo });
    }

    static ghi(tep, duLieu) {
        return ApiClient.goi(tep, { method: 'POST', duLieu });
    }

    static _xuLyHetPhien() {
        try {
            localStorage.removeItem('manv');
            localStorage.removeItem('token');
        } catch (e) { /* bỏ qua */ }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Phiên đăng nhập đã hết hạn',
                text: 'Vui lòng đăng nhập lại để tiếp tục.',
                allowOutsideClick: false,
                confirmButtonText: 'Đăng nhập lại'
            }).then(() => { window.location.href = 'index.html'; });
        } else {
            window.location.href = 'index.html';
        }
    }
}

/** Lỗi có kèm mã HTTP, để nơi gọi phân biệt được loại lỗi. */
export class LoiApi extends Error {
    constructor(thongBao, maHttp) {
        super(thongBao);
        this.name = 'LoiApi';
        this.maHttp = maHttp;
    }
}
