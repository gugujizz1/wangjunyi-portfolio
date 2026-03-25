/* ========================================
   王俊毅个人作品集 - 主脚本
   主要功能：导航、作品筛选、动效、表单处理
   ======================================== */

// ==========================================
// 常量与全局变量
// ==========================================

const NAV_ITEMS = ['home', 'works', 'about', 'contact'];
let currentCategory = 'all';
let allWorks = [];
let currentScrollSection = 'home';


// ==========================================
// 1. 导航栏功能
// ==========================================

// 初始化导航栏
function initNavbar() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // 汉堡菜单切换
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // 导航项点击
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                // 关闭移动端菜单
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');

                // 平滑滚动到目标位置
                const targetPosition = targetSection.offsetTop - 70;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 监听滚动位置，更新导航高亮
    window.addEventListener('scroll', updateNavHighlight);
}

// 更新导航高亮
function updateNavHighlight() {
    const sections = NAV_ITEMS.map(id => ({
        id,
        element: document.getElementById(id),
        link: document.querySelector(`[href="#${id}"]`)
    })).filter(item => item.element);

    let currentId = 'home';
    const scrollPosition = window.scrollY + 100;

    for (let section of sections) {
        if (section.element.offsetTop <= scrollPosition) {
            currentId = section.id;
        } else {
            break;
        }
    }

    // 更新所有导航项
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[href="#${currentId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    currentScrollSection = currentId;
}

// ==========================================
// 2. 作品展示功能
// ==========================================

// 从 Supabase 加载作品数据
async function loadWorks() {
    try {
        const rows = await sbDB.getWorks();
        if (rows && rows.length > 0) {
            allWorks = rows.map(row => ({
                id: row.id,
                title: row.title,
                category: row.category,
                subcategory: row.subcategory || '',
                description: row.description || '',
                thumbnail: row.thumbnail || '',
                details: row.details || {}
            }));
        } else {
            // Supabase 无数据时降级到本地 JSON
            const resp = await fetch('data/works.json');
            allWorks = await resp.json();
        }
    } catch (error) {
        console.error('加载作品数据失败:', error);
        try {
            const resp = await fetch('data/works.json');
            allWorks = await resp.json();
        } catch { allWorks = []; }
    }
    currentCategory = 'cultural';
    renderWorks('cultural');
}

// 渲染作品卡片
function renderWorks(category) {
    const worksGrid = document.getElementById('works-grid');
    worksGrid.innerHTML = '';

    // 筛选作品
    let filteredWorks = allWorks;
    if (category !== 'all') {
        filteredWorks = allWorks.filter(work => work.category === category);
    }

    // 创建卡片
    filteredWorks.forEach((work, index) => {
        const card = createWorkCard(work);
        // 使用 CSS 动画延迟而不是 GSAP
        card.style.setProperty('--delay', `${index * 0.1}s`);
        worksGrid.appendChild(card);
    });

    // 添加懒加载
    lazyLoadImages();

    // 为新渲染的卡片添加 GSAP 动画（使用防抖避免重复创建）
    if (!prefersReducedMotion) {
        // 清理之前的动画
        const existingTriggers = ScrollTrigger.getAll().filter(trigger => 
            trigger.vars.trigger === '.works' || trigger.vars.trigger?.classList?.contains('work-card')
        );
        existingTriggers.forEach(trigger => trigger.kill());

        // 创建新动画
        gsap.from('.work-card', {
            scrollTrigger: {
                trigger: '.works',
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            duration: 0.6,
            opacity: 0,
            y: 20,
            stagger: 0.08,
            ease: 'power2.out'
        });
    }
}

// 创建作品卡片 DOM
function createWorkCard(work) {
    const card = document.createElement('div');
    card.className = 'work-card';
    card.style.cursor = 'pointer';

    const categoryName = getCategoryName(work.category);
    const subcategoryName = getSubcategoryName(work.subcategory);

    card.innerHTML = `
        <div class="work-card-image">
            <img src="${work.thumbnail}" alt="${work.title}" loading="lazy" data-src="${work.thumbnail}">
        </div>
        <div class="work-card-content">
            <span class="work-card-category">${categoryName}</span>
            <h3 class="work-card-title">${work.title}</h3>
            <p class="work-card-description">${work.description}</p>
            <div class="work-card-footer">
                <span class="view-btn">
                    查看详情
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        openWorkDetail(work);
    });

    return card;
}

// 打开作品详情
function openWorkDetail(work) {
    sessionStorage.setItem('currentWorkId', work.id);
    sessionStorage.setItem('currentCategory', currentCategory);
    // 带 ?id= 参数支持直接分享链接
    window.location.href = `work-detail.html?id=${encodeURIComponent(work.id)}`;
}

// 分类标签点击处理
function initCategoryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active 类
            filterBtns.forEach(b => b.classList.remove('active'));
            // 添加 active 到当前按钮
            btn.classList.add('active');

            // 获取分类值
            const filter = btn.getAttribute('data-filter');
            currentCategory = filter;

            // 淡出动画
            const grid = document.getElementById('works-grid');
            gsap.to(grid, {
                duration: 0.3,
                opacity: 0,
                onComplete: () => {
                    renderWorks(filter);
                    gsap.to(grid, {
                        duration: 0.3,
                        opacity: 1
                    });
                }
            });
        });
    });
}

// ==========================================
// 3. 图片懒加载
// ==========================================

function lazyLoadImages() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src') || img.src;

                    // 创建新图片以验证加载
                    const newImg = new Image();
                    newImg.onload = () => {
                        img.src = src;
                        img.classList.remove('skeleton');
                        observer.unobserve(img);
                    };
                    newImg.onerror = () => {
                        img.classList.remove('skeleton');
                        observer.unobserve(img);
                    };
                    newImg.src = src;
                }
            });
        });

        images.forEach(img => {
            img.classList.add('skeleton');
            imageObserver.observe(img);
        });
    } else {
        // 不支持 IntersectionObserver 的浏览器
        images.forEach(img => {
            img.src = img.getAttribute('data-src') || img.src;
        });
    }
}

// ==========================================
// 4. 表单处理
// ======================================== 

function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        // 获取表单数据
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            message: document.getElementById('message').value.trim()
        };

        // 验证
        const validation = validateForm(formData);
        if (!validation.valid) {
            e.preventDefault();
            showFormMessage(validation.error, 'error');
            return;
        }

        // 禁用按钮
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';
    });
}

function validateForm(data) {
    if (!data.name) {
        return { valid: false, error: '请输入您的姓名' };
    }
    if (!data.email) {
        return { valid: false, error: '请输入您的邮箱' };
    }
    if (!isValidEmail(data.email)) {
        return { valid: false, error: '请输入正确的邮箱格式' };
    }
    if (!data.message) {
        return { valid: false, error: '请输入留言内容' };
    }
    if (data.message.length < 10) {
        return { valid: false, error: '留言内容至少需要10个字符' };
    }
    return { valid: true };
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFormMessage(message, type) {
    const messageEl = document.getElementById('form-message');
    messageEl.textContent = message;
    messageEl.className = `form-message ${type}`;
}

// ==========================================
// 5. 动效与GSAP配置
// ==========================================

// 注册 GSAP 插件
gsap.registerPlugin(ScrollTrigger);

// 性能优化：使用 reduce motion 检测
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initAnimations() {
    if (prefersReducedMotion) {
        // 如果用户偏好减少动画，跳过GSAP动画
        document.querySelectorAll('.section-title').forEach(el => {
            el.style.opacity = '1';
        });
        return;
    }

    // 标题动画 - 确保元素始终保持可见
    gsap.utils.toArray('.section-title').forEach(element => {
        // 确保初始状态可见
        gsap.set(element, { opacity: 1 });
        
        gsap.from(element, {
            scrollTrigger: {
                trigger: element,
                start: 'top 90%',
                once: true  // 只播放一次，避免反复触发
            },
            duration: 0.8,
            opacity: 0,
            y: 20,
            ease: 'power2.out'
        });
    });
}

// ==========================================
// 6. 工具函数
// ==========================================

function getCategoryName(category) {
    const categoryMap = {
        'cultural': '文化宣传',
        'community': '社区内容',
        'language': '语言服务',
        'other': '其他作品'
    };
    return categoryMap[category] || category;
}

function getSubcategoryName(subcategory) {
    const subcategoryMap = {
        'event': '事件',
        'people': '人物',
        'product': '产品',
        'ugc': 'UGC内容',
        'system': '体系',
        'compile': '编译',
        'translate': '翻译',
        'literature': '文学',
        'research': '研究'
    };
    return subcategoryMap[subcategory] || subcategory;
}

// ==========================================
// 7. 页面初始化
// ==========================================

async function init() {
    // 检查是否为详情页
    const isDetailPage = document.body.classList.contains('detail-page');
    
    if (!isDetailPage) {
        // 必须先 await 站点数据写入，再启动动画，避免动画覆盖数据
        await loadSiteData();
        initNavbar();
        loadWorks();
        initCategoryFilters();
        initContactForm();
        try {
            initAnimations();
        } catch (e) {
            console.error('initAnimations error:', e);
        }
        
        // 页面加载后更新导航高亮
        updateNavHighlight();
    } else {
        // 详情页初始化
        initDetailPage();
    }
}

// ==========================================
// 9. 从后台数据动态渲染 Hero & About
// ==========================================

async function loadSiteData() {
    let site = null;
    try {
        site = await sbDB.getSiteData();
        if (!site) {
            const resp = await fetch('data/sitedata.json');
            site = await resp.json();
        }
    } catch (e) {
        console.error('[前端] loadSiteData 失败:', e);
        try {
            const resp = await fetch('data/sitedata.json');
            site = await resp.json();
        } catch { return; }
    }
    if (!site) return;
    if (site.hero) applyHeroData(site.hero);
    if (site.about) applyAboutData(site.about);
}

function applyHeroData(hero) {
    const titleEl = document.querySelector('.hero-title');
    const subtitleEl = document.querySelector('.hero-subtitle');
    const descEl = document.querySelector('.hero-description');
    const photoEl = document.querySelector('.hero-image img');
    const btnPrimary = document.querySelector('.hero-buttons .btn.btn-primary');
    const btnSecondary = document.querySelector('.hero-buttons .btn.btn-secondary');

    if (titleEl && hero.title) titleEl.textContent = hero.title;
    if (subtitleEl && hero.subtitle) subtitleEl.textContent = hero.subtitle;
    if (descEl && hero.description) descEl.textContent = hero.description;
    if (photoEl && hero.photo) photoEl.src = hero.photo;
    if (btnPrimary && hero.btnPrimary) btnPrimary.textContent = hero.btnPrimary;
    if (btnSecondary && hero.btnSecondary) btnSecondary.textContent = hero.btnSecondary;
}

function applyAboutData(about) {
    // 照片
    const photoEl = document.querySelector('.about-image img');
    if (photoEl && about.photo) photoEl.src = about.photo;

    // 个人简介
    const introEl = document.querySelector('.about-intro p');
    if (introEl && about.intro) introEl.textContent = about.intro;

    // 技能
    if (about.skills && about.skills.length > 0) {
        const skillsGrid = document.querySelector('.skills-grid');
        if (skillsGrid) {
            skillsGrid.innerHTML = about.skills
                .map(s => `<span class="skill-tag">${s}</span>`).join('');
        }
    }

    // 教育经历
    if (about.education && about.education.length > 0) {
        const eduContainer = document.querySelector('.about-section:nth-child(2) .column-items');
        if (eduContainer) {
            eduContainer.innerHTML = about.education.map(edu => `
                <div class="item">
                    <h4>${edu.school}</h4>
                    <p class="degree">${edu.degree}</p>
                    <p class="time">${edu.time}</p>
                </div>`).join('');
        }
    }

    // 实习经历
    if (about.internships && about.internships.length > 0) {
        const internContainer = document.querySelector('.about-section:nth-child(3) .column-items');
        if (internContainer) {
            internContainer.innerHTML = about.internships.map(intern => `
                <div class="item">
                    <h4>${intern.company}</h4>
                    <p class="position">${intern.position}</p>
                    <p class="time">${intern.time}</p>
                </div>`).join('');
        }
    }
}

// ==========================================
// 8. 作品详情页功能
// ==========================================

async function initDetailPage() {
    // 返回按钮：优先返回上一页，如果无历史则跳到首页
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (document.referrer && document.referrer !== window.location.href) {
                history.back();
            } else {
                window.location.href = 'index.html';
            }
        });
    }

    const workId = sessionStorage.getItem('currentWorkId');
    if (!workId) {
        // 直接从 URL 参数读取（支持分享链接）
        const urlId = new URLSearchParams(window.location.search).get('id');
        if (!urlId) { window.location.href = 'index.html'; return; }
        loadWorkById(urlId);
        return;
    }
    loadWorkById(workId);
}

async function loadWorkById(workId) {
    try {
        const rows = await sbFetch(`/rest/v1/works?id=eq.${encodeURIComponent(workId)}&limit=1`);
        if (rows && rows.length > 0) {
            const row = rows[0];
            displayWorkDetail({
                id: row.id,
                title: row.title,
                category: row.category,
                subcategory: row.subcategory || '',
                description: row.description || '',
                thumbnail: row.thumbnail || '',
                details: row.details || {}
            });
        } else {
            console.error('[前端] 未找到作品:', workId);
        }
    } catch (e) {
        console.error('[前端] 加载作品详情失败:', e);
    }
}

function displayWorkDetail(work) {
    const titleEl = document.querySelector('.detail-title');
    const metaEl = document.querySelector('.detail-meta');
    const contentEl = document.querySelector('.detail-content');
    const imagesEl = document.querySelector('.detail-images');

    if (titleEl) titleEl.textContent = work.title;

    if (metaEl) {
        metaEl.innerHTML = `
            <div class="detail-meta-item">
                <span class="detail-meta-label">分类</span>
                <span class="detail-meta-value">${getCategoryName(work.category)}</span>
            </div>
            <div class="detail-meta-item">
                <span class="detail-meta-label">类型</span>
                <span class="detail-meta-value">${work.details.type}</span>
            </div>
            <div class="detail-meta-item">
                <span class="detail-meta-label">创作时间</span>
                <span class="detail-meta-value">${work.details.date}</span>
            </div>
        `;
    }

    if (contentEl) {
        // 优先渲染富文本 HTML，降级时拼合旧字段
        let bodyHtml = work.details.content_html || '';
        if (!bodyHtml) {
            const d = work.details;
            if (d.background)  bodyHtml += `<h3>创作背景</h3><p>${d.background}</p>`;
            if (d.content)     bodyHtml += `<h3>核心内容</h3><p>${d.content}</p>`;
            if (d.scenes)      bodyHtml += `<h3>应用场景</h3><p>${d.scenes}</p>`;
            if (d.achievement) bodyHtml += `<h3>成果成就</h3><p>${d.achievement}</p>`;
        }
        // 追加链接
        if (work.details.links && work.details.links.length > 0) {
            bodyHtml += `<div class="detail-links">${work.details.links.map(link =>
                `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="detail-link">${link.text}</a>`
            ).join('')}</div>`;
        }
        contentEl.innerHTML = bodyHtml;
    }

    if (imagesEl && work.details.images && work.details.images.length > 0) {
        imagesEl.innerHTML = work.details.images.map(img => `
            <div class="detail-image">
                <img src="${img}" alt="详情图片">
            </div>
        `).join('');
    } else if (imagesEl) {
        imagesEl.innerHTML = '';
    }
}

// ==========================================
// 启动应用
// ==========================================

// 确保 DOM 加载完成且 supabase.js 已加载后再初始化
let _initiated = false;
function safeInit() {
    if (_initiated) return;
    // 若 sbDB 还未定义（supabase.js 尚未加载），等待后重试
    if (typeof sbDB === 'undefined') {
        setTimeout(safeInit, 50);
        return;
    }
    _initiated = true;
    init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}


// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
});
