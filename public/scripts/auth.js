import { supabase } from '../supabase/client.js';

console.log('📄 Script loaded:', window.location.href);
// Kiểm tra đăng nhập
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    console.log('🔍 Auth.js checking path:', currentPath);
    
    if (currentPath === '/' || currentPath === '/index' || currentPath === '/index.html') {
        supabase.auth.getUser().then(({ data: { user } }) => {
            console.log('👤 User status:', user ? 'Logged in' : 'Not logged in');
            if (user) {
                console.log('🔄 Redirecting to player (already logged in)');
                window.location.href = "/player.html";
            } else {
                const authContainer = document.getElementById("authContainer");
                if (authContainer) {
                    authContainer.style.display = "block";
                    console.log('👁️ Showing auth form');
                }
            }
        }).catch(error => {
            console.error('❌ Auth check error:', error);
        });
    }
});


function displayError(inputId, message) {
    // Xóa tất cả lỗi trước khi hiển thị lỗi mới (hoặc xóa lỗi)
    const errorElement = document.getElementById(`${inputId}Error`);
    const inputElement = document.getElementById(inputId);

    // KHI GỌI displayError, CHỈ XỬ LÝ LỖI CỦA TRƯỜNG HIỆN TẠI
    if (errorElement && inputElement) {
        // 1. Reset trạng thái
        errorElement.textContent = '';
        errorElement.classList.remove('active');
        inputElement.classList.remove('error');

        // 2. Thiết lập trạng thái mới (nếu có message)
        if (message) {
            errorElement.textContent = message;
            errorElement.classList.add('active');
            inputElement.classList.add('error');
        }
    }
}

// Kiểm tra định dạng Email cơ bản
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Kiểm tra định dạng Mật khẩu: 8+ ký tự, bao gồm hoa, thường, số, ký tự đặc biệt
function isValidPassword(password) {
    const minLength = 8;
    // Regex: (?=.*[a-z]) (chữ thường), (?=.*[A-Z]) (chữ hoa), (?=.*\d) (số), (?=.*[\W_]) (ký tự đặc biệt)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return passwordRegex.test(password);
}

async function signup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const birthday = document.getElementById('signupBirthday').value;

    // Xóa lỗi cũ
    displayError('signupUsername', null);
    displayError('signupEmail', null);
    displayError('signupPassword', null);
    displayError('confirmPassword', null);
    displayError('signupBirthday', null);

    let hasClientError = false;

    // 1. Kiểm tra trường bắt buộc
    if (!username) { displayError('signupUsername', 'Vui lòng nhập Tên người dùng.'); hasClientError = true; }
    if (!email) { displayError('signupEmail', 'Vui lòng nhập Email.'); hasClientError = true; } 
    else if (!isValidEmail(email)) { displayError('signupEmail', 'Định dạng Email không hợp lệ.'); hasClientError = true; }
    
    if (!password) { displayError('signupPassword', 'Vui lòng nhập Mật khẩu.'); hasClientError = true; }
    else if (!isValidPassword(password)) { 
        displayError('signupPassword', 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'); 
        hasClientError = true; 
    }
    
    if (!confirmPassword) { displayError('confirmPassword', 'Vui lòng nhập lại Mật khẩu.'); hasClientError = true; }
    else if (password !== confirmPassword) {
        displayError('confirmPassword', 'Mật khẩu xác nhận không khớp.');
        hasClientError = true;
    }
    
    if (!birthday) { displayError('signupBirthday', 'Vui lòng nhập Ngày sinh.'); hasClientError = true; }
    
    if (hasClientError) return;

    // 2. Kiểm tra Mật khẩu và Xác nhận
    if (password !== confirmPassword) {
        displayError('confirmPassword', 'Mật khẩu xác nhận không khớp.');
        hasError = true;
    }
    
    // 3. Kiểm tra Định dạng Email
    if (!isValidEmail(email)) {
        displayError('signupEmail', 'Định dạng Email không hợp lệ.');
        hasError = true;
    }
    
    // 4. Kiểm tra Độ mạnh Mật khẩu
    if (!isValidPassword(password)) {
        displayError('signupPassword', 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
        hasError = true;
    }

    if (hasError) return;


    try {
        // 5. Kiểm tra Tên người dùng trùng lặp trong DB
        // GIẢ ĐỊNH: Bạn có bảng 'users' với cột 'username' (tham chiếu từ image_c13d59.png)
        const { count: usernameCount, error: usernameCheckError } = await supabase
            .from('users')
            .select('username', { count: 'exact' })
            .eq('username', username);

        if (usernameCheckError) throw new Error(`Lỗi kiểm tra tên người dùng: ${usernameCheckError.message}`);

        if (usernameCount > 0) {
            displayError('signupUsername', 'Tên người dùng này đã tồn tại.');
            return; // Thoát vì lỗi trùng lặp (server error)
        }

        // 6. Thực hiện Đăng ký qua Supabase (Supabase sẽ kiểm tra trùng lặp Email)
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    username: username, // Lưu tên đăng nhập vào user metadata
                    birthday: birthday
                }
            }
        });

        if (error) {
            // Supabase trả về lỗi trùng lặp Email hoặc lỗi khác
            if (error.message.includes('already registered')) {
                displayError('signupEmail', 'Email này đã được đăng ký.');
            } else {
                displayError('signupEmail', `Đăng ký thất bại: ${error.message}`);
            }
            return;
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            alert('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
            window.location.href = '/index.html';
        } else {
            window.location.href = '/player.html';
        }

    } catch (error) {
        console.error('Lỗi hệ thống khi đăng ký:', error);
        displayError('signupEmail', `Lỗi hệ thống: ${error.message}`);
    }
}


async function loginWithEmail() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Xóa lỗi cũ
    displayError('loginEmail', null); 
    displayError('loginPassword', null);

    if (!email || !password) {
        // Hiển thị lỗi ngay dưới ô thiếu thông tin
        if (!email) displayError('loginEmail', 'Vui lòng nhập Email.');
        if (!password) displayError('loginPassword', 'Vui lòng nhập Mật khẩu.');
        return;
    }

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            // Thay thế alert() bằng thông báo lỗi cụ thể
            if (error.message.includes('Invalid login credentials')) {
                displayError('loginPassword', 'Email hoặc mật khẩu không chính xác.');
            } else {
                displayError('loginPassword', `Đăng nhập thất bại: ${error.message}`);
            }
            return;
        }

        // Đăng nhập thành công
        window.location.href = '/player.html'; 

    } catch (error) {
        displayError('loginPassword', `Lỗi hệ thống: ${error.message}`);
    }
};
// Đăng nhập bằng Google
async function loginWithGoogle() {
    console.log('Login with Google called');
    
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/player.html`
            }
        });

        if (error) throw error;
    } catch (error) {
        alert('Lỗi đăng nhập Google: ' + error.message);
        console.error('Google login error:', error);
    }
}

// window.signup = signup;
// window.loginWithEmail = loginWithEmail;
// window.loginWithGoogle = loginWithGoogle;


async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Chuyển về trang đăng nhập
        window.location.href = '/index.html'; 
    } catch (error) {
        console.error('Lỗi đăng xuất:', error);
        alert('Đăng xuất thất bại: ' + error.message);
    }
}

window.authFunctions = {
    signup,
    loginWithEmail, 
    loginWithGoogle,
    logout
};
