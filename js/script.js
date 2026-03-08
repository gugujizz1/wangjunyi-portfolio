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

// 从 JSON 加载作品数据
async function loadWorks() {
try {
const response = await fetch('data/works.json');
allWorks = await response.json();
currentCategory = 'cultural';
renderWorks('cultural');
} catch (error) {
console.error('加载作品数据失败:', error);
// 备用：使用内联数据
currentCategory = 'cultural';
renderWorks('cultural');
}
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
    // 保存当前作品到本地存储
    localStorage.setItem('currentWork', JSON.stringify(work));
    localStorage.setItem('currentCategory', currentCategory);
    
    // 跳转到详情页
    window.location.href = 'work-detail.html';
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

function init() {
    // 检查是否为详情页
    const isDetailPage = document.body.classList.contains('detail-page');
    
    if (!isDetailPage) {
        // 首页初始化
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
// 8. 作品详情页功能
// ==========================================

function initDetailPage() {
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const category = localStorage.getItem('currentCategory') || 'all';
            history.back();
        });
    }

    // 加载作品详情
    const workData = localStorage.getItem('currentWork');
    if (workData) {
        const work = JSON.parse(workData);
        displayWorkDetail(work);
    }

    // 懒加载详情页图片
    lazyLoadImages();
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
        contentEl.innerHTML = `
            <h3>创作背景</h3>
            <p>${work.details.background}</p>
            <h3 style="margin-top: var(--spacing-lg);">核心内容</h3>
            <p>${work.details.content}</p>
            <h3 style="margin-top: var(--spacing-lg);">应用场景</h3>
            <p>${work.details.scenes}</p>
            ${work.details.achievement ? `
                <h3 style="margin-top: var(--spacing-lg);">成果成就</h3>
                <p>${work.details.achievement}</p>
            ` : ''}
            ${work.details.links && work.details.links.length > 0 ? `
                <div class="detail-links">
                    ${work.details.links.map(link => `
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="detail-link">
                            ${link.text}
                        </a>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    if (imagesEl && work.details.images && work.details.images.length > 0) {
        imagesEl.innerHTML = work.details.images.map(img => `
            <div class="detail-image">
                <img src="${img}" alt="详情图片" loading="lazy" data-src="${img}">
            </div>
        `).join('');
    }
}

// ==========================================
// 启动应用
// ==========================================

// 确保 DOM 加载完成后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
});
