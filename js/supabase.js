/* ==========================================
   Supabase 客户端 & 数据操作封装
   ========================================== */

const SUPABASE_URL = 'https://rikpbswnllmasocvblxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hMzSB4eGDyJRN3Tosx8W0w_XU-2YQPy';
// Bucket ID（在 Supabase Dashboard → Storage 中显示的名称/ID）
// 注意：Supabase Storage API 的 URL 中 bucket 名需要用 encodeURIComponent 转义
const STORAGE_BUCKET = "wangjunyi's bucket";

// ==========================================
// 底层 HTTP 工具
// ==========================================

async function sbFetch(path, options = {}) {
    const url = `${SUPABASE_URL}${path}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${(sbCurrentToken() || SUPABASE_ANON_KEY)}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: resp.statusText }));
        throw new Error(err.message || err.error_description || resp.statusText);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
}

function sbCurrentToken() {
    try {
        const raw = localStorage.getItem('sb_session');
        if (!raw) return null;
        const session = JSON.parse(raw);
        // 检查是否过期
        if (session.expires_at && Date.now() / 1000 > session.expires_at) {
            localStorage.removeItem('sb_session');
            return null;
        }
        return session.access_token;
    } catch { return null; }
}

// ==========================================
// Auth 认证
// ==========================================

const sbAuth = {
    // 邮箱密码登录
    async signIn(email, password) {
        const data = await sbFetch('/auth/v1/token?grant_type=password', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        // 存储 session
        localStorage.setItem('sb_session', JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + data.expires_in
        }));
        return data;
    },

    // 登出
    async signOut() {
        try {
            await sbFetch('/auth/v1/logout', { method: 'POST' });
        } catch { /* 忽略错误 */ }
        localStorage.removeItem('sb_session');
    },

    // 获取当前用户
    getUser() {
        const token = sbCurrentToken();
        if (!token) return null;
        try {
            // 解析 JWT payload
            const payload = JSON.parse(atob(token.split('.')[1]));
            return { id: payload.sub, email: payload.email, role: payload.role };
        } catch { return null; }
    },

    // 是否已登录
    isLoggedIn() {
        return !!sbCurrentToken();
    }
};

// ==========================================
// 数据库操作
// ==========================================

const sbDB = {
    // ---- site_data ----
    async getSiteData() {
        const rows = await sbFetch('/rest/v1/site_data?id=eq.main&limit=1');
        return rows && rows.length > 0 ? rows[0].data : null;
    },

    async upsertSiteData(data) {
        return sbFetch('/rest/v1/site_data', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ id: 'main', data, updated_at: new Date().toISOString() })
        });
    },

    // ---- works ----
    async getWorks() {
        const rows = await sbFetch('/rest/v1/works?order=sort_order.asc,updated_at.asc&limit=200');
        return rows || [];
    },

    async upsertWork(work) {
        return sbFetch('/rest/v1/works', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
                id: work.id,
                title: work.title,
                category: work.category,
                subcategory: work.subcategory || '',
                description: work.description || '',
                thumbnail: work.thumbnail || '',
                details: work.details || {},
                sort_order: work.sort_order || 0,
                updated_at: new Date().toISOString()
            })
        });
    },

    async deleteWork(id) {
        return sbFetch(`/rest/v1/works?id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    },

    // 批量 upsert（初始化数据用）
    async upsertWorks(works) {
        return sbFetch('/rest/v1/works', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(works.map((w, i) => ({
                id: w.id,
                title: w.title,
                category: w.category,
                subcategory: w.subcategory || '',
                description: w.description || '',
                thumbnail: w.thumbnail || '',
                details: w.details || {},
                sort_order: i,
                updated_at: new Date().toISOString()
            })))
        });
    }
};

// ==========================================
// Storage 图片上传
// ==========================================

const sbStorage = {
    // 上传文件，返回公开访问 URL
    async upload(file, savePath) {
        const token = sbCurrentToken();
        if (!token) throw new Error('请先登录后再上传图片');

        // savePath 格式：images/works/cultural/work-c-001/封面.png
        // bucket 名和路径分别编码，用 / 连接
        const bucketEncoded = encodeURIComponent(STORAGE_BUCKET);
        const filePathEncoded = savePath.split('/').map(encodeURIComponent).join('/');
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucketEncoded}/${filePathEncoded}`;


        const resp = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': file.type || 'application/octet-stream',
                'x-upsert': 'true'  // 同名文件覆盖
            },
            body: file
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => resp.statusText);
            console.error('[Storage] 上传失败:', resp.status, errText);
            let errMsg = '上传失败';
            try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
            throw new Error(`${errMsg} (HTTP ${resp.status})`);
        }

        // 返回公开 URL
        return `${SUPABASE_URL}/storage/v1/object/public/${bucketEncoded}/${filePathEncoded}`;
    },

    // 获取公开 URL（已上传的文件）
    getPublicUrl(path) {
        const bucketEncoded = encodeURIComponent(STORAGE_BUCKET);
        const filePathEncoded = path.split('/').map(encodeURIComponent).join('/');
        return `${SUPABASE_URL}/storage/v1/object/public/${bucketEncoded}/${filePathEncoded}`;
    }
};
