/* ==========================================
   作品集后台管理系统 - 主脚本
   存储方案：Supabase 云端数据库 + Storage
   ========================================== */

// ==========================================
// 常量 & 工具
// ==========================================

// 显示 Toast 提示
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 2600);
}

// 更新保存状态指示器
function setSaveStatus(state) {
    const dot = document.getElementById('save-status')?.querySelector('.status-dot');
    const text = document.getElementById('save-status')?.querySelector('.status-text');
    if (!dot || !text) return;
    dot.className = `status-dot ${state}`;
    const map = { saved: '数据已保存', saving: '正在保存...', error: '保存失败' };
    text.textContent = map[state] || '';
}

// 生成唯一 ID
function genId(prefix = 'work') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// 将文件上传到 Supabase Storage，返回公开访问 URL
// savePath：存储路径，如 images/works/cultural/work-c-001/封面.png
async function uploadImageToServer(file, savePath) {
    const filePath = `${savePath}/${file.name}`.replace(/\/\//g, '/');
    return await sbStorage.upload(file, filePath);
}

// 将文件读取为 ObjectURL（仅用于本地预览，不持久化）
function fileToObjectURL(file) {
    return URL.createObjectURL(file);
}

// 将文件读取为 base64（降级备用，仅限小图片）
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 设置图片预览（支持 URL 和 base64）
function setImagePreview(previewId, placeholderId, src) {
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    if (!preview) return;
    if (src) {
        preview.src = src;
        preview.classList.remove('hidden');
        if (placeholder) placeholder.style.display = 'none';
    } else {
        preview.src = '';
        preview.classList.add('hidden');
        if (placeholder) placeholder.style.display = '';
    }
}

// ==========================================
// 富文本编辑器（Quill）
// ==========================================

let quillEditor = null;

function initQuillEditor() {
    if (quillEditor) return; // 已初始化则跳过
    quillEditor = new Quill('#work-content-editor', {
        theme: 'snow',
        placeholder: '输入作品详情内容……支持加粗、斜体、列表、链接等格式',
        modules: {
            toolbar: [
                [{ 'size': ['small', false, 'large', 'huge'] }],
                ['bold', 'italic', 'underline'],
                [{ 'color': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ]
        }
    });
}

// ==========================================
// 数据管理层
// ==========================================

let siteData = null;
let worksData = [];

// 从 Supabase 加载所有数据
async function loadAllData() {
    // 加载站点数据（hero + about）
    try {
        const remote = await sbDB.getSiteData();
        if (remote) {
            siteData = remote;
        } else {
            // Supabase 中还没有数据，从 sitedata.json 加载并写入
            const resp = await fetch('data/sitedata.json?' + Date.now());
            siteData = await resp.json();
            // 静默写入 Supabase（不阻塞，失败不影响展示）
            sbDB.upsertSiteData(siteData).catch(() => {});
        }
    } catch (e) {
        console.error('[后台] 加载 site_data 失败:', e);
        siteData = { hero: {}, about: { skills: [], education: [], internships: [] } };
    }

    // 加载作品数据
    try {
        const remoteWorks = await sbDB.getWorks();
        if (remoteWorks && remoteWorks.length > 0) {
            // 将扁平行结构还原为前端使用的 work 对象
            worksData = remoteWorks.map(row => ({
                id: row.id,
                title: row.title,
                category: row.category,
                subcategory: row.subcategory,
                description: row.description,
                thumbnail: row.thumbnail,
                details: row.details || {},
                sort_order: row.sort_order
            }));
        } else {
            // Supabase 中还没有作品，从 works.json 加载并批量导入
            const resp = await fetch('data/works.json?' + Date.now());
            const originalWorks = await resp.json();
            worksData = originalWorks.map(work => {
                const details = { ...work.details };
                if (!details.content_html) {
                    details.content_html = buildHtmlFromLegacy(details);
                }
                return { ...work, details };
            });
            // 批量写入 Supabase
            sbDB.upsertWorks(worksData).catch(e => console.error('[后台] 批量导入作品失败:', e));
        }
    } catch (e) {
        console.error('[后台] 加载 works 失败:', e);
        worksData = [];
    }
}

// 将旧版四字段（background/content/scenes/achievement）拼合为 HTML 字符串
function buildHtmlFromLegacy(details) {
    if (!details) return '';
    const parts = [];
    if (details.background) parts.push(`<h3>创作背景</h3><p>${details.background}</p>`);
    if (details.content)    parts.push(`<h3>核心内容</h3><p>${details.content}</p>`);
    if (details.scenes)     parts.push(`<h3>应用场景</h3><p>${details.scenes}</p>`);
    if (details.achievement) parts.push(`<h3>成果成就</h3><p>${details.achievement}</p>`);
    return parts.join('');
}

// 保存站点数据到 Supabase
async function saveSiteData() {
    setSaveStatus('saving');
    try {
        await sbDB.upsertSiteData(siteData);
        setSaveStatus('saved');
    } catch (e) {
        console.error('[后台] 保存 site_data 失败:', e);
        setSaveStatus('error');
        showToast('保存失败：' + e.message, 'error');
    }
}

// 保存单条作品到 Supabase（saveWork 调用）
async function saveWorksData(workObj) {
    setSaveStatus('saving');
    try {
        await sbDB.upsertWork(workObj);
        // 同步更新本地 worksData
        const idx = worksData.findIndex(w => w.id === workObj.id);
        if (idx !== -1) worksData[idx] = workObj;
        else worksData.push(workObj);
        setSaveStatus('saved');
    } catch (e) {
        console.error('[后台] 保存作品失败:', e);
        setSaveStatus('error');
        showToast('保存失败：' + e.message, 'error');
        throw e; // 让调用方感知失败
    }
}

// ==========================================
// 侧边栏导航
// ==========================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const main = document.getElementById('admin-main');

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const panelId = item.getAttribute('data-panel');
            if (!panelId) return;

            // 切换激活态
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // 切换面板
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(`panel-${panelId}`);
            if (panel) panel.classList.add('active');

            // 移动端关闭侧边栏
            if (window.innerWidth <= 900) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    // 侧边栏折叠
    toggleBtn?.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
            sidebar.classList.toggle('mobile-open');
        } else {
            sidebar.classList.toggle('collapsed');
            const layout = document.querySelector('.admin-layout');
            layout.classList.toggle('sidebar-collapsed');
        }
    });
}

// 更新侧边栏作品数量角标
function updateBadges() {
    const categories = ['cultural', 'community', 'language', 'other'];
    categories.forEach(cat => {
        const count = worksData.filter(w => w.category === cat).length;
        const badge = document.getElementById(`badge-${cat}`);
        if (badge) badge.textContent = count;
    });
}

// ==========================================
// Hero 面板
// ==========================================

function initHeroPanel() {
    const h = siteData.hero || {};
    document.getElementById('hero-title').value = h.title || '';
    document.getElementById('hero-subtitle').value = h.subtitle || '';
    document.getElementById('hero-description').value = h.description || '';
    document.getElementById('hero-btn-primary').value = h.btnPrimary || '';
    document.getElementById('hero-btn-secondary').value = h.btnSecondary || '';
    document.getElementById('hero-photo-url').value = h.photo || '';
    if (h.photo) setImagePreview('hero-photo-preview', 'hero-photo-placeholder', h.photo);

    // 图片上传
    document.getElementById('hero-photo-file').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        // 先用 ObjectURL 做即时预览
        const previewUrl = fileToObjectURL(file);
        setImagePreview('hero-photo-preview', 'hero-photo-placeholder', previewUrl);
        document.getElementById('hero-photo-url').value = '上传中...';
        try {
            const relPath = await uploadImageToServer(file, 'images/avatars');
            siteData.hero.photo = relPath;
            document.getElementById('hero-photo-url').value = relPath;
            setImagePreview('hero-photo-preview', 'hero-photo-placeholder', relPath);
            showToast('✅ 照片已保存到 ' + relPath);
        } catch (err) {
            console.warn('[上传] 服务器不支持上传，使用 base64 降级:', err.message);
            const b64 = await fileToBase64(file);
            siteData.hero.photo = b64;
            document.getElementById('hero-photo-url').value = '（已上传，仅本地预览）';
        }
    });

    // 点击预览区域触发上传
    document.getElementById('hero-photo-placeholder')?.addEventListener('click', () => {
        document.getElementById('hero-photo-file').click();
    });

    // URL 应用
    document.getElementById('hero-photo-url-btn').addEventListener('click', () => {
        const url = document.getElementById('hero-photo-url').value.trim();
        if (url) setImagePreview('hero-photo-preview', 'hero-photo-placeholder', url);
    });

    // 保存
    document.getElementById('save-hero').addEventListener('click', () => {
        siteData.hero = {
            ...siteData.hero,
            title: document.getElementById('hero-title').value.trim(),
            subtitle: document.getElementById('hero-subtitle').value.trim(),
            description: document.getElementById('hero-description').value.trim(),
            btnPrimary: document.getElementById('hero-btn-primary').value.trim(),
            btnSecondary: document.getElementById('hero-btn-secondary').value.trim(),
        };
        // photo 已在上传/url应用时更新，这里只更新文字url
        const urlVal = document.getElementById('hero-photo-url').value.trim();
        const blockedPhotoVals = ['上传中...', '（已上传，仅本地预览）', '（已上传本地图片）'];
        if (urlVal && !blockedPhotoVals.includes(urlVal)) {
            siteData.hero.photo = urlVal;
        }
        saveSiteData();
        showToast('✅ Hero 首屏已保存');
    });
}

// ==========================================
// 个人介绍面板
// ==========================================

function initAboutPanel() {
    const a = siteData.about || {};

    // 照片
    if (a.photo) setImagePreview('about-photo-preview', 'about-photo-placeholder', a.photo);
    document.getElementById('about-photo-url').value = a.photo || '';
    document.getElementById('about-intro').value = a.intro || '';

    document.getElementById('about-photo-file').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const previewUrl = fileToObjectURL(file);
        setImagePreview('about-photo-preview', 'about-photo-placeholder', previewUrl);
        document.getElementById('about-photo-url').value = '上传中...';
        try {
            const relPath = await uploadImageToServer(file, 'images/avatars');
            siteData.about.photo = relPath;
            document.getElementById('about-photo-url').value = relPath;
            setImagePreview('about-photo-preview', 'about-photo-placeholder', relPath);
            showToast('✅ 照片已保存到 ' + relPath);
        } catch (err) {
            console.warn('[上传] 服务器不支持上传，使用 base64 降级:', err.message);
            const b64 = await fileToBase64(file);
            siteData.about.photo = b64;
            document.getElementById('about-photo-url').value = '（已上传，仅本地预览）';
        }
    });

    document.getElementById('about-photo-placeholder')?.addEventListener('click', () => {
        document.getElementById('about-photo-file').click();
    });

    document.getElementById('about-photo-url-btn').addEventListener('click', () => {
        const url = document.getElementById('about-photo-url').value.trim();
        if (url) setImagePreview('about-photo-preview', 'about-photo-placeholder', url);
    });

    document.getElementById('save-about-intro').addEventListener('click', () => {
        const urlVal = document.getElementById('about-photo-url').value.trim();
        const blockedPhotoVals = ['上传中...', '（已上传，仅本地预览）', '（已上传本地图片）'];
        if (urlVal && !blockedPhotoVals.includes(urlVal)) siteData.about.photo = urlVal;
        siteData.about.intro = document.getElementById('about-intro').value.trim();
        saveSiteData();
        showToast('✅ 照片 & 简介已保存');
    });

    // 技能
    renderSkillTags(a.skills || []);
    document.getElementById('add-skill-btn').addEventListener('click', addSkillTag);
    document.getElementById('skill-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addSkillTag(); }
    });
    document.getElementById('save-about-skills').addEventListener('click', () => {
        siteData.about.skills = getCurrentSkills();
        saveSiteData();
        showToast('✅ 技能标签已保存');
    });

    // 教育经历
    renderExperienceList('education-list', a.education || [], 'education');
    document.getElementById('add-education-btn').addEventListener('click', () => {
        const list = siteData.about.education || [];
        list.push({ school: '', degree: '', time: '' });
        siteData.about.education = list;
        renderExperienceList('education-list', list, 'education');
    });
    document.getElementById('save-about-education').addEventListener('click', () => {
        siteData.about.education = collectEducation();
        saveSiteData();
        showToast('✅ 教育经历已保存');
    });

    // 实习经历
    renderExperienceList('internship-list', a.internships || [], 'internship');
    document.getElementById('add-internship-btn').addEventListener('click', () => {
        const list = siteData.about.internships || [];
        list.push({ company: '', position: '', time: '' });
        siteData.about.internships = list;
        renderExperienceList('internship-list', list, 'internship');
    });
    document.getElementById('save-about-internships').addEventListener('click', () => {
        siteData.about.internships = collectInternships();
        saveSiteData();
        showToast('✅ 实习经历已保存');
    });
}

// --- 技能标签 ---
function renderSkillTags(skills) {
    const container = document.getElementById('skills-tags');
    container.innerHTML = '';
    skills.forEach((skill, idx) => {
        const tag = document.createElement('div');
        tag.className = 'skill-tag';
        tag.draggable = true;
        tag.dataset.idx = idx;
        tag.innerHTML = `<span>${skill}</span><span class="skill-tag-remove" title="删除">×</span>`;
        tag.querySelector('.skill-tag-remove').addEventListener('click', () => {
            skills.splice(idx, 1);
            renderSkillTags(skills);
        });
        // 拖拽排序
        tag.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', idx); tag.classList.add('dragging'); });
        tag.addEventListener('dragend', () => tag.classList.remove('dragging'));
        tag.addEventListener('dragover', e => e.preventDefault());
        tag.addEventListener('drop', e => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = idx;
            if (fromIdx === toIdx) return;
            const moved = skills.splice(fromIdx, 1)[0];
            skills.splice(toIdx, 0, moved);
            renderSkillTags(skills);
        });
        container.appendChild(tag);
    });
}

function addSkillTag() {
    const input = document.getElementById('skill-input');
    const val = input.value.trim();
    if (!val) return;
    const skills = getCurrentSkills();
    if (skills.includes(val)) { showToast('该技能已存在', 'warning'); return; }
    skills.push(val);
    renderSkillTags(skills);
    input.value = '';
}

function getCurrentSkills() {
    return [...document.querySelectorAll('#skills-tags .skill-tag span:first-child')]
        .map(el => el.textContent.trim()).filter(Boolean);
}

// --- 经历列表 ---
function renderExperienceList(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'experience-item';
        div.dataset.idx = idx;
        if (type === 'education') {
            div.innerHTML = `
                <div class="experience-item-header">
                    <span class="experience-item-title">${item.school || '新建教育经历'}</span>
                    <div class="experience-item-actions">
                        <button class="btn-danger del-exp" title="删除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            删除
                        </button>
                    </div>
                </div>
                <div class="experience-item-grid">
                    <div class="form-group">
                        <label class="form-label">学校名称</label>
                        <input type="text" class="form-input edu-school" value="${item.school || ''}" placeholder="学校名称">
                    </div>
                    <div class="form-group">
                        <label class="form-label">学历/专业</label>
                        <input type="text" class="form-input edu-degree" value="${item.degree || ''}" placeholder="如：编辑出版学（硕士）">
                    </div>
                    <div class="form-group">
                        <label class="form-label">时间</label>
                        <input type="text" class="form-input edu-time" value="${item.time || ''}" placeholder="如：2023 - 2026">
                    </div>
                </div>`;
        } else {
            div.innerHTML = `
                <div class="experience-item-header">
                    <span class="experience-item-title">${item.company || '新建实习经历'}</span>
                    <div class="experience-item-actions">
                        <button class="btn-danger del-exp" title="删除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            删除
                        </button>
                    </div>
                </div>
                <div class="experience-item-grid">
                    <div class="form-group">
                        <label class="form-label">公司名称</label>
                        <input type="text" class="form-input intern-company" value="${item.company || ''}" placeholder="公司名称">
                    </div>
                    <div class="form-group">
                        <label class="form-label">职位</label>
                        <input type="text" class="form-input intern-position" value="${item.position || ''}" placeholder="如：文化活动运营实习生">
                    </div>
                    <div class="form-group">
                        <label class="form-label">时间</label>
                        <input type="text" class="form-input intern-time" value="${item.time || ''}" placeholder="如：2025.07 - 2025.12">
                    </div>
                </div>`;
        }
        div.querySelector('.del-exp').addEventListener('click', () => {
            items.splice(idx, 1);
            renderExperienceList(containerId, items, type);
        });
        container.appendChild(div);
    });
}

function collectEducation() {
    return [...document.querySelectorAll('#education-list .experience-item')].map(item => ({
        school: item.querySelector('.edu-school')?.value.trim() || '',
        degree: item.querySelector('.edu-degree')?.value.trim() || '',
        time: item.querySelector('.edu-time')?.value.trim() || ''
    }));
}

function collectInternships() {
    return [...document.querySelectorAll('#internship-list .experience-item')].map(item => ({
        company: item.querySelector('.intern-company')?.value.trim() || '',
        position: item.querySelector('.intern-position')?.value.trim() || '',
        time: item.querySelector('.intern-time')?.value.trim() || ''
    }));
}

// ==========================================
// 作品列表面板
// ==========================================

function initWorksPanels() {
    const categories = ['cultural', 'community', 'language', 'other'];
    categories.forEach(cat => renderWorksList(cat));

    // 新增作品按钮
    document.querySelectorAll('[data-add-work]').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-add-work');
            openWorkModal(null, cat);
        });
    });

    updateBadges();
}

function renderWorksList(category) {
    const container = document.getElementById(`works-list-${category}`);
    if (!container) return;
    const works = worksData.filter(w => w.category === category);
    container.innerHTML = '';
    if (works.length === 0) {
        container.innerHTML = `<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">暂无作品，点击"新增作品"开始添加</div>`;
        return;
    }
    works.forEach(work => {
        const item = createWorkListItem(work);
        container.appendChild(item);
    });
}

function createWorkListItem(work) {
    const item = document.createElement('div');
    item.className = 'work-item';
    item.dataset.id = work.id;

    const thumbSrc = work.thumbnail || '';
    const thumbHtml = thumbSrc
        ? `<img src="${thumbSrc}" alt="${work.title}" onerror="this.parentNode.innerHTML='<div class=\\'work-item-thumb-placeholder\\'>无图</div>'">`
        : `<div class="work-item-thumb-placeholder">无封面</div>`;

    item.innerHTML = `
        <div class="work-item-thumb">${thumbHtml}</div>
        <div class="work-item-info">
            <div class="work-item-title">${work.title || '（未命名）'}</div>
            <div class="work-item-desc">${work.description || ''}</div>
            <div class="work-item-meta">
                <span class="work-item-tag">${work.details?.type || '—'}</span>
                <span class="work-item-tag">${work.details?.date || '—'}</span>
                ${work.details?.links?.length ? '<span class="work-item-tag">有跳转链接</span>' : ''}
            </div>
        </div>
        <div class="work-item-actions">
            <button class="btn-secondary small edit-work-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                编辑
            </button>
            <button class="btn-danger delete-work-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                删除
            </button>
        </div>`;

    item.querySelector('.edit-work-btn').addEventListener('click', () => openWorkModal(work, work.category));
    item.querySelector('.delete-work-btn').addEventListener('click', () => deleteWork(work.id, work.category));

    return item;
}

async function deleteWork(id, category) {
    if (!confirm('确定要删除这个作品吗？此操作不可撤销。')) return;
    try {
        await sbDB.deleteWork(id);
        const idx = worksData.findIndex(w => w.id === id);
        if (idx !== -1) worksData.splice(idx, 1);
        renderWorksList(category);
        updateBadges();
        showToast('✅ 作品已删除');
    } catch (e) {
        showToast('删除失败：' + e.message, 'error');
    }
}

// ==========================================
// 作品编辑弹窗
// ==========================================

let currentEditWork = null;

function openWorkModal(work, category) {
    currentEditWork = work;
    const modal = document.getElementById('work-modal-overlay');
    const titleEl = document.getElementById('work-modal-title');
    titleEl.textContent = work ? '编辑作品' : '新增作品';

    // 填充表单
    document.getElementById('work-edit-id').value = work?.id || '';
    document.getElementById('work-edit-category').value = category;
    document.getElementById('work-title').value = work?.title || '';
    document.getElementById('work-subcategory').value = work?.subcategory || '';
    document.getElementById('work-description').value = work?.description || '';
    document.getElementById('work-type').value = work?.details?.type || '';
    document.getElementById('work-date').value = work?.details?.date || '';
    document.getElementById('work-thumbnail-url').value = work?.thumbnail || '';

    // 封面预览
    if (work?.thumbnail) {
        setImagePreview('work-thumbnail-preview', 'work-thumbnail-placeholder', work.thumbnail);
    } else {
        setImagePreview('work-thumbnail-preview', 'work-thumbnail-placeholder', '');
    }

    // 详情配图
    renderDetailImagesList(work?.details?.images || []);

    // 链接
    renderLinksList(work?.details?.links || []);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Quill 需要在元素可见后初始化（首次打开弹窗时）
    initQuillEditor();
    // 重新填充富文本内容（init 后再写一次，避免初始化时覆盖）
    const contentHtml = work?.details?.content_html || buildHtmlFromLegacy(work?.details) || '';
    if (quillEditor) {
        quillEditor.root.innerHTML = contentHtml;
    }
}

function closeWorkModal() {
    document.getElementById('work-modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
    currentEditWork = null;
}

// 获取当前编辑作品的图片保存目录
function getWorkImageDir() {
    const id  = document.getElementById('work-edit-id').value.trim();
    const cat = document.getElementById('work-edit-category').value || 'other';
    if (id) return `images/works/${cat}/${id}`;
    return `images/uploads`;
}

// 封面图片上传
function initModalImageUpload() {
    document.getElementById('work-thumbnail-file').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        // 即时本地预览
        const previewUrl = fileToObjectURL(file);
        setImagePreview('work-thumbnail-preview', 'work-thumbnail-placeholder', previewUrl);
        document.getElementById('work-thumbnail-url').value = '上传中...';
        try {
            const remoteUrl = await uploadImageToServer(file, getWorkImageDir());
            document.getElementById('work-thumbnail-url').value = remoteUrl;
            setImagePreview('work-thumbnail-preview', 'work-thumbnail-placeholder', remoteUrl);
            if (!currentEditWork) currentEditWork = {};
            currentEditWork._uploadedThumb = remoteUrl;
            showToast('✅ 封面上传成功');
        } catch (err) {
            console.error('[上传] 封面上传失败:', err);
            document.getElementById('work-thumbnail-url').value = '';
            showToast('封面上传失败：' + err.message, 'error');
        }
        e.target.value = '';
    });

    document.getElementById('work-thumbnail-placeholder')?.addEventListener('click', () => {
        document.getElementById('work-thumbnail-file').click();
    });

    document.getElementById('work-thumbnail-upload-btn')?.addEventListener('click', () => {
        document.getElementById('work-thumbnail-file').click();
    });

    document.getElementById('work-thumbnail-url-btn').addEventListener('click', () => {
        const url = document.getElementById('work-thumbnail-url').value.trim();
        const blocked = ['（已上传本地图片）', '上传中...', '（已上传，仅本地预览）'];
        if (url && !blocked.includes(url)) {
            setImagePreview('work-thumbnail-preview', 'work-thumbnail-placeholder', url);
        }
    });
}

// --- 详情配图列表 ---
let detailImages = [];

function renderDetailImagesList(images) {
    detailImages = [...images];
    const container = document.getElementById('work-detail-images-list');
    container.innerHTML = '';
    detailImages.forEach((src, idx) => {
        const item = document.createElement('div');
        item.className = 'detail-image-item';
        item.innerHTML = `
            <div class="detail-image-thumb">
                <img src="${src}" alt="配图" onerror="this.style.display='none'">
            </div>
            <div class="detail-image-path">${src.startsWith('data:') ? '[已上传图片]' : src}</div>
            <button class="detail-image-remove" title="删除此图">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
        item.querySelector('.detail-image-remove').addEventListener('click', () => {
            detailImages.splice(idx, 1);
            renderDetailImagesList(detailImages);
        });
        container.appendChild(item);
    });
}

function initDetailImageUpload() {
    document.getElementById('add-detail-image-file-btn').addEventListener('click', () => {
        document.getElementById('work-detail-image-file').click();
    });
    document.getElementById('work-detail-image-file').addEventListener('change', async e => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            // 先插入占位，上传完成后替换
            const placeholderIdx = detailImages.length;
            detailImages.push('__uploading__');
            renderDetailImagesList(detailImages);
            try {
                const remoteUrl = await uploadImageToServer(file, getWorkImageDir());
                detailImages[placeholderIdx] = remoteUrl;
                renderDetailImagesList(detailImages);
                showToast('✅ 配图上传成功');
            } catch (err) {
                console.error('[上传] 配图上传失败:', err);
                detailImages.splice(placeholderIdx, 1); // 移除占位
                renderDetailImagesList(detailImages);
                showToast('配图上传失败：' + err.message, 'error');
            }
        }
        e.target.value = '';
    });
    document.getElementById('add-detail-image-url-btn').addEventListener('click', () => {
        const url = document.getElementById('work-detail-image-url').value.trim();
        if (!url) return;
        detailImages.push(url);
        renderDetailImagesList(detailImages);
        document.getElementById('work-detail-image-url').value = '';
    });
    document.getElementById('work-detail-image-url').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('add-detail-image-url-btn').click();
        }
    });
}

// --- 链接列表 ---
let workLinks = [];

function renderLinksList(links) {
    workLinks = links ? links.map(l => ({ ...l })) : [];
    const container = document.getElementById('work-links-list');
    container.innerHTML = '';
    workLinks.forEach((link, idx) => {
        const item = document.createElement('div');
        item.className = 'link-item';
        item.innerHTML = `
            <input type="text" class="form-input link-item-text" value="${link.text || ''}" placeholder="链接文字（如：查看原文）">
            <input type="text" class="form-input" value="${link.url || ''}" placeholder="链接地址（https://...）">
            <button class="link-item-remove" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
        item.querySelector('.link-item-remove').addEventListener('click', () => {
            workLinks.splice(idx, 1);
            renderLinksList(workLinks);
        });
        container.appendChild(item);
    });
}

function collectLinks() {
    return [...document.querySelectorAll('#work-links-list .link-item')].map(item => ({
        text: item.querySelectorAll('.form-input')[0]?.value.trim() || '',
        url: item.querySelectorAll('.form-input')[1]?.value.trim() || ''
    })).filter(l => l.url);
}

// 保存作品
async function saveWork() {
    const id = document.getElementById('work-edit-id').value.trim();
    const category = document.getElementById('work-edit-category').value;
    const title = document.getElementById('work-title').value.trim();
    if (!title) { showToast('请输入作品标题', 'error'); return; }

    // 获取封面：优先用 input 里的值（上传成功后写入相对路径，手动输入同理）
    let thumbnail = document.getElementById('work-thumbnail-url').value.trim();
    // 占位词：上传进行中或降级后的提示文字，不应被当作路径存储
    const blockedThumbVals = ['上传中...', '（已上传，仅本地预览）', '（已上传本地图片）'];
    if (blockedThumbVals.includes(thumbnail)) {
        // 降级场景：取 base64 暂存值，或保留原封面
        thumbnail = currentEditWork?._tempThumb || currentEditWork?.thumbnail || '';
    }
    // 过滤掉 __uploading__ 占位（配图上传中途保存的情况）
    const cleanImages = detailImages.filter(img => img !== '__uploading__');

    const workObj = {
        id: id || genId('work'),
        title,
        category,
        subcategory: document.getElementById('work-subcategory').value.trim(),
        description: document.getElementById('work-description').value.trim(),
        thumbnail,
        details: {
            type: document.getElementById('work-type').value.trim(),
            date: document.getElementById('work-date').value.trim(),
            content_html: quillEditor ? quillEditor.root.innerHTML : '',
            images: cleanImages,
            links: collectLinks()
        }
    };

    // 保存到 Supabase（saveWorksData 内部也会同步 worksData 数组）
    try {
        await saveWorksData(workObj);
    } catch { return; } // saveWorksData 内部已显示 toast 错误

    renderWorksList(category);
    updateBadges();
    closeWorkModal();
    showToast('✅ 作品已保存');
}

// ==========================================
// 导出 & 导入 & 重置
// ==========================================

function exportAllData() {
    const exportData = {
        _exportTime: new Date().toISOString(),
        sitedata: siteData,
        works: worksData
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ 数据已导出');
}

function importAllData(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.sitedata) {
                siteData = data.sitedata;
                sbDB.upsertSiteData(siteData).catch(() => {});
            }
            if (data.works) {
                worksData = data.works;
                sbDB.upsertWorks(worksData).catch(() => {});
            }
            // 刷新所有面板
            location.reload();
        } catch (err) {
            showToast('导入失败：JSON 格式错误', 'error');
        }
    };
    reader.readAsText(file);
}

async function resetAllData() {
    if (!confirm('⚠️ 确定要重置所有数据吗？\n这将从原始 JSON 文件重新导入数据到 Supabase，覆盖所有修改。')) return;
    try {
        // 从原始 JSON 重新加载并批量写入
        const [siteResp, worksResp] = await Promise.all([
            fetch('data/sitedata.json?' + Date.now()),
            fetch('data/works.json?' + Date.now())
        ]);
        const newSiteData = await siteResp.json();
        const newWorksData = await worksResp.json();
        await Promise.all([
            sbDB.upsertSiteData(newSiteData),
            sbDB.upsertWorks(newWorksData)
        ]);
        showToast('数据已重置，正在刷新...', 'warning');
        setTimeout(() => location.reload(), 800);
    } catch (e) {
        showToast('重置失败：' + e.message, 'error');
    }
}

// ==========================================
// 全局事件绑定
// ==========================================

function initGlobalEvents() {
    // 弹窗关闭
    document.getElementById('work-modal-close').addEventListener('click', closeWorkModal);
    document.getElementById('work-modal-cancel').addEventListener('click', closeWorkModal);
    document.getElementById('work-modal-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('work-modal-overlay')) closeWorkModal();
    });

    // 弹窗保存
    document.getElementById('work-modal-save').addEventListener('click', saveWork);

    // 添加链接
    document.getElementById('add-link-btn').addEventListener('click', () => {
        workLinks.push({ text: '查看原文', url: '' });
        renderLinksList(workLinks);
    });

    // 导出
    document.getElementById('export-btn').addEventListener('click', exportAllData);

    // 导入
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) importAllData(file);
    });

    // 重置
    document.getElementById('reset-btn').addEventListener('click', resetAllData);

    // ESC 关闭弹窗
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeWorkModal();
    });
}

// ==========================================
// 主初始化
// ==========================================

async function initAdmin() {
    // 未登录则跳转到登录页
    if (!sbAuth.isLoggedIn()) {
        window.location.replace('login.html');
        return;
    }

    // 注入登出按钮事件（如果 DOM 中存在）
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await sbAuth.signOut();
            window.location.replace('login.html');
        });
    }

    await loadAllData();
    initNavigation();
    initHeroPanel();
    initAboutPanel();
    initWorksPanels();
    initModalImageUpload();
    initDetailImageUpload();
    initGlobalEvents();
    setSaveStatus('saved');
}

document.addEventListener('DOMContentLoaded', initAdmin);
