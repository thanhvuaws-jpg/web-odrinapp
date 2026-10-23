/**
 * Bảng màu Sơn Son cho Tailwind — dùng chung cho quản trị, thu ngân, đăng nhập.
 *
 * Mã giao diện cũ được viết cho nền tối: chữ text-white / text-gray-300,
 * khung bg-black/40, nhấn text-gold-400, trạng thái text-red-400... Hàng trăm
 * class như vậy nằm rải rác trong HTML và trong chuỗi HTML do js/screens/*
 * dựng ra. Viết lại từng chỗ thì dễ sót, nên ở đây ĐẢO bảng màu: trang vẫn
 * giữ class "dark" trên <html> (để các biến thể dark: tiếp tục áp), nhưng mỗi
 * tên màu trỏ sang màu Sơn Son có cùng VAI TRÒ trên nền kem:
 *   - xám/slate: số nhỏ (chữ sáng trên nền tối) → mực đậm; số lớn (nền) → kem, ngà
 *   - white  → mực (chữ chính), black → be (lớp lót mờ của ô nhập, khung phụ)
 *   - gold   → son (chữ nhấn, nút chính); viền gold được css/son-son.css đổi sang vàng
 *   - đỏ/xanh/vàng/lam → son, ngọc, hổ phách, chàm — đậm đủ để đọc trên nền sáng
 * Những chỗ cần chữ sáng thật (chữ trắng trên nút đặc) do css/son-son.css lo.
 *
 * Nạp NGAY SAU script Tailwind CDN, trước khối tailwind.config của trang.
 */
(function () {
    const trungTinh = {
        50: '#1F120D', 100: '#2A1A14', 200: '#3A281F', 300: '#4E3A2E', 400: '#7A6553',
        500: '#86705C', 600: '#B39F86', 700: '#DCCDB3', 800: '#F3E9D6', 900: '#FFFDF8',
        950: '#F7EEDD'
    };
    const dai = (nhat, vua, dam) => ({
        50: nhat[0], 100: nhat[1], 200: dam[0], 300: dam[1], 400: dam[2],
        500: vua[0], 600: vua[1], 700: dam[3], 800: dam[4], 900: dam[5], 950: dam[5]
    });
    const son = dai(['#FBEAE7', '#F7E0DC'], ['#B3261F', '#8E1B17'],
                    ['#A8261D', '#A3231C', '#B3261F', '#5E0E0C', '#4A0B09', '#3E0908']);
    const ngoc = dai(['#EAF3EE', '#E2EFE8'], ['#3C8A6E', '#2E6B57'],
                     ['#245644', '#2A6150', '#2E6B57', '#245644', '#1C4436', '#14332A']);
    const hoPhach = dai(['#FCF4E3', '#FBEFD6'], ['#C08427', '#A86A12'],
                        ['#7E500D', '#8A580E', '#A86A12', '#7E500D', '#5F3C0A', '#432A07']);
    const cham = dai(['#EEF1F7', '#E4EAF4'], ['#4A69A8', '#34508A'],
                     ['#263C66', '#2B4470', '#34508A', '#263C66', '#1C2D4D', '#141F36']);
    const tim = dai(['#F5EEF7', '#EFE4F2'], ['#8E5AA0', '#6B3D7A'],
                    ['#4E2C59', '#5A3166', '#6B3D7A', '#4E2C59', '#3B2143', '#29172F']);

    window.SON_SON_MAU = {
        white: '#2A1A14',
        black: '#E3D2B2',
        gray: trungTinh, slate: trungTinh, zinc: trungTinh, neutral: trungTinh, stone: trungTinh,
        red: son, rose: son, pink: son,
        green: ngoc, emerald: ngoc, teal: ngoc, lime: ngoc,
        yellow: hoPhach, amber: hoPhach, orange: hoPhach,
        blue: cham, sky: cham, indigo: cham, cyan: cham,
        purple: tim, violet: tim, fuchsia: tim,
        gold: { DEFAULT: '#8E1B17', 300: '#B3261F', 400: '#8E1B17', 500: '#5E0E0C', 600: '#5E0E0C' },
        son: { DEFAULT: '#8E1B17', sang: '#B3261F', dam: '#5E0E0C' },
        vang: { DEFAULT: '#D9A441', dam: '#A8771F', sang: '#FFE3A0' },
        kem: { DEFAULT: '#F7EEDD', dam: '#EFE2CA' },
        nga: '#FFFDF8',
        muc: '#2A1A14',
        'chu-mo': '#7A6553',
        ngoc: '#2E6B57',
        'ho-phach': '#A86A12'
    };

    window.SON_SON_FONT = {
        serif: ['"Baloo 2"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        sans: ['"Be Vietnam Pro"', '"Segoe UI"', 'system-ui', 'sans-serif']
    };
})();
