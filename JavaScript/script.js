// 初始化Supabase客户端
const supabaseUrl = 'https://jsfhuzfwelpynhlyptzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZmh1emZ3ZWxweW5obHlwdHpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDMxMjEsImV4cCI6MjA2NTMxOTEyMX0.xFZoeHRxe1RKbdi2h0jqPO0hTXnMHl85ihGLU6E6PAs';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 获取DOM元素
const nicknameInput = document.getElementById('nickname');
const messageInput = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');
const messagesList = document.getElementById('messages-list');
const sortSelect = document.getElementById('sort-select');
const totalMessagesEl = document.getElementById('total-messages');
const todayMessagesEl = document.getElementById('today-messages');
const totalPagesDisplay = document.getElementById('total-pages-display');
const currentPageEl = document.getElementById('current-page');

// 分页元素
const firstPageBtn = document.getElementById('first-page');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const lastPageBtn = document.getElementById('last-page');

// 分页变量
let currentPage = 1;
let totalPages = 1;
const messagesPerPage = 15; // 每页15条留言

// 存储用户点赞状态
let likedMessages = JSON.parse(localStorage.getItem('likedMessages') || '{}');
// 正在处理的点赞请求
const pendingLikes = new Set();

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 加载统计数据
    await loadStats();

    // 加载留言
    loadMessages();

    // 添加事件监听器
    submitBtn.addEventListener('click', submitMessage);
    sortSelect.addEventListener('change', loadMessages);

    // 绑定分页按钮事件
    bindPaginationEvents();
});

// 绑定分页按钮事件
function bindPaginationEvents() {
    firstPageBtn.addEventListener('click', () => goToPage(1));
    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    lastPageBtn.addEventListener('click', () => goToPage(totalPages));
}

// 跳转到指定页面
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;

    // 存储滚动位置目标
    sessionStorage.setItem('scrollToMessages', 'true');

    loadMessages();
}

// 更新分页控件状态
function updatePaginationControls() {
    currentPageEl.textContent = currentPage;
    totalPagesDisplay.textContent = totalPages;

    // 更新按钮状态
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    lastPageBtn.disabled = currentPage === totalPages;
}

// 加载留言
async function loadMessages() {
    messagesList.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner"></i>
                    <p>正在加载第 ${currentPage} 页留言...</p>
                </div>
            `;

    try {
        // 计算起始位置
        const startIndex = (currentPage - 1) * messagesPerPage;

        // 根据选择排序方式
        let query = supabase
            .from('messages')
            .select('*', { count: 'exact' });

        if (sortSelect.value === 'newest') {
            query = query.order('created_at', { ascending: false });
        } else if (sortSelect.value === 'oldest') {
            query = query.order('created_at', { ascending: true });
        } else if (sortSelect.value === 'most-liked') {
            query = query.order('likes', { ascending: false });
        }

        // 获取留言数据（带分页）
        let { data: messages, error, count } = await query
            .range(startIndex, startIndex + messagesPerPage - 1);

        if (error) throw error;

        displayMessages(messages);
        updatePaginationControls();

        // 检查是否需要滚动到留言列表
        if (sessionStorage.getItem('scrollToMessages') === 'true') {
            // 等待一个短暂延迟确保DOM已更新
            setTimeout(() => {
                const messagesContainer = document.querySelector('.messages-container');
                if (messagesContainer) {
                    messagesContainer.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
                // 清除标记
                sessionStorage.removeItem('scrollToMessages');
            }, 100); // 100ms延迟
        }
    } catch (error) {
        messagesList.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>加载留言失败: ${error.message}</p>
                    </div>
                `;
    }
}

// 显示留言
function displayMessages(messages) {
    messagesList.innerHTML = '';

    if (!messages || messages.length === 0) {
        messagesList.innerHTML = `
                    <div class="empty-message">
                        <i class="fas fa-comment-slash" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <p>暂无留言，成为第一个留言者吧！</p>
                    </div>
                `;
        return;
    }

    // 显示留言
    messages.forEach((msg) => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message-card';

        // 检查用户是否已点赞
        const isLiked = likedMessages[msg.id] || false;

        // 为每条留言添加评论区域
        messageElement.innerHTML = `
                    <div class="message-header">
                        <div class="message-author">
                            <i class="fas fa-user"></i> ${msg.nickname || '匿名用户'}
                        </div>
                        <div class="message-time">
                            <i class="fas fa-clock"></i> ${formatDate(msg.created_at)}
                        </div>
                    </div>
                    <div class="message-content">${msg.content}</div>
                    
                    <!-- 操作按钮容器 -->
                    <div class="action-container">
                        <!-- 点赞区域 -->
                        <div class="like-container">
                            <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${msg.id}">
                                <i class="fas fa-heart"></i>
                            </button>
                            <span class="like-count">${msg.likes || 0}</span>
                        </div>
                        
                        <!-- 评论按钮 -->
                        <div class="comment-container">
                            <button class="comment-btn" data-id="${msg.id}">
                                <i class="fas fa-comment"></i>
                            </button>
                            <span class="comment-count">${msg.comments || 0}</span>
                        </div>
                    </div>
                    
                    <!-- 评论区域 - 默认隐藏 -->
                    <div class="comments-section" id="comments-${msg.id}">
                        <div class="comment-form">
                            <input type="text" class="comment-nickname" placeholder="昵称（可选）">
                            <textarea class="comment-content" placeholder="写下你的评论..."></textarea>
                            <button class="submit-comment" data-id="${msg.id}">发表评论</button>
                        </div>
                        <div class="comments-list" id="comments-list-${msg.id}">
                            <!-- 评论将在这里动态加载 -->
                        </div>
                    </div>
                `;
        messagesList.appendChild(messageElement);
    });

    // 为点赞按钮添加事件监听器
    document.querySelectorAll('.like-btn').forEach(button => {
        button.addEventListener('click', likeMessage);
    });

    // 为评论按钮添加事件监听器
    document.querySelectorAll('.comment-btn').forEach(button => {
        button.addEventListener('click', toggleComments);
    });

    // 为发表评论按钮添加事件监听器
    document.querySelectorAll('.submit-comment').forEach(button => {
        button.addEventListener('click', submitComment);
    });
}

// 点赞功能
async function likeMessage(event) {
    const button = event.currentTarget;
    const messageId = button.dataset.id;

    // 检查是否已点赞
    if (likedMessages[messageId]) {
        showNotification('您已经点过赞了！', 'info');
        return;
    }

    // 检查是否正在处理中
    if (pendingLikes.has(messageId)) {
        showNotification('正在处理点赞，请稍候...', 'info');
        return;
    }

    // 添加到处理中集合
    pendingLikes.add(messageId);

    try {
        // 立即更新UI
        button.classList.add('liked');
        const likeCountEl = button.parentNode.querySelector('.like-count');
        const currentLikes = parseInt(likeCountEl.textContent);
        const newLikes = currentLikes + 1;
        likeCountEl.textContent = newLikes;

        // 添加动画效果
        button.classList.add('animating');

        // 获取当前点赞数
        const { data: message, error: getError } = await supabase
            .from('messages')
            .select('likes')
            .eq('id', messageId)
            .single();

        if (getError) throw getError;

        // 更新点赞数
        const dbLikes = (message.likes || 0) + 1;

        const { error: updateError } = await supabase
            .from('messages')
            .update({ likes: dbLikes })
            .eq('id', messageId);

        if (updateError) throw updateError;

        // 保存点赞状态
        likedMessages[messageId] = true;
        localStorage.setItem('likedMessages', JSON.stringify(likedMessages));

        // 显示成功消息
        showNotification('点赞成功！', 'success');

        // 移除动画
        setTimeout(() => {
            button.classList.remove('animating');
        }, 500);
    } catch (error) {
        // 回滚UI
        button.classList.remove('liked');
        const likeCountEl = button.parentNode.querySelector('.like-count');
        const currentLikes = parseInt(likeCountEl.textContent);
        likeCountEl.textContent = Math.max(0, currentLikes - 1);

        showNotification(`点赞失败: ${error.message}`, 'error');
    } finally {
        // 从处理中集合移除
        pendingLikes.delete(messageId);
    }
}

// 提交留言
async function submitMessage() {
    const nickname = nicknameInput.value.trim();
    const content = messageInput.value.trim();

    if (!content) {
        showNotification('留言内容不能为空！', 'error');
        messageInput.focus();
        return;
    }

    try {
        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';

        // 显示临时留言
        document.getElementById('temp-nickname').textContent = nickname || '匿名用户';
        document.getElementById('temp-content').textContent = content;
        document.getElementById('submit-status').style.display = 'block';

        // 滚动到临时留言位置
        document.getElementById('submit-status').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    nickname: nickname || null,
                    content: content,
                    likes: 0,
                    comments: 0
                }
            ]);

        if (error) throw error;

        // 清空表单
        messageInput.value = '';
        nicknameInput.value = '';

        // 隐藏临时留言
        document.getElementById('submit-status').style.display = 'none';

        // 重新加载统计数据
        await loadStats();

        // 跳转到第一页查看新留言
        currentPage = 1;
        loadMessages();

        // 显示成功消息
        showNotification('留言发布成功！', 'success');
    } catch (error) {
        // 更新临时留言状态为错误
        document.querySelector('.message-status').innerHTML = `
                    <i class="fas fa-exclamation-circle"></i> 提交失败: ${error.message}
                `;
        document.querySelector('.message-status').style.color = '#e74c3c';

        showNotification(`发布失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布留言';
    }
}

// 加载统计数据
async function loadStats() {
    try {
        // 总留言数
        const { count: totalCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });

        totalMessagesEl.textContent = totalCount || 0;

        // 今日留言数
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const { count: todayCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString())
            .lt('created_at', todayEnd.toISOString());

        todayMessagesEl.textContent = todayCount || 0;

        // 计算总页数
        totalPages = Math.ceil(totalCount / messagesPerPage);
        totalPagesDisplay.textContent = totalPages;

        // 更新分页控件状态
        updatePaginationControls();
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/\//g, '-');
}

// 显示通知
function showNotification(message, type) {
    // 移除现有通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
            'info-circle'}"></i>
                <span>${message}</span>
            `;

    document.body.appendChild(notification);

    // 显示通知
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    // 3秒后移除通知
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 评论功能
async function toggleComments(event) {
    const button = event.currentTarget;
    const messageId = button.dataset.id;
    const commentSection = document.getElementById(`comments-${messageId}`);

    // 切换评论区域显示状态
    commentSection.classList.toggle('expanded');

    // 更新按钮状态
    button.classList.toggle('active', commentSection.classList.contains('expanded'));

    // 如果评论区域展开，加载评论
    if (commentSection.classList.contains('expanded')) {
        await loadComments(messageId);
    }
}

// 加载评论
async function loadComments(messageId) {
    const commentsList = document.getElementById(`comments-list-${messageId}`);
    commentsList.innerHTML = '<div class="loading" style="padding: 10px; font-size: 0.9rem;"><i class="fas fa-spinner"></i> 加载评论中...</div>';

    try {
        // 从Supabase获取评论数据
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*')
            .eq('message_id', messageId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderComments(messageId, comments);
    } catch (error) {
        commentsList.innerHTML = `<div class="error" style="padding: 10px;">加载评论失败: ${error.message}</div>`;
    }
}

// 渲染评论
function renderComments(messageId, comments) {
    const commentsList = document.getElementById(`comments-list-${messageId}`);

    if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<div class="empty-message" style="padding: 20px; font-size: 0.9rem;">暂无评论</div>';
        return;
    }

    let commentsHTML = '';
    comments.forEach(comment => {
        commentsHTML += `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author">${comment.nickname || '匿名用户'}</span>
                            <span class="comment-time">${formatDate(comment.created_at)}</span>
                        </div>
                        <div class="comment-content">${comment.content}</div>
                    </div>
                `;
    });

    commentsList.innerHTML = commentsHTML;
}

// 提交评论
async function submitComment(event) {
    const button = event.currentTarget;
    const messageId = button.dataset.id;
    const commentForm = button.parentNode;
    const nicknameInput = commentForm.querySelector('.comment-nickname');
    const contentInput = commentForm.querySelector('.comment-content');

    const nickname = nicknameInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
        showNotification('评论内容不能为空！', 'error');
        contentInput.focus();
        return;
    }

    // 禁用提交按钮防止重复点击
    button.disabled = true;
    button.textContent = '提交中...';

    // 创建临时评论对象（立即显示）
    const tempComment = {
        id: 'temp-' + Date.now(),
        nickname: nickname || '匿名用户',
        content: content,
        created_at: new Date().toISOString(),
        isTemp: true
    };

    // 立即添加到评论列表顶部
    addTempComment(messageId, tempComment);

    try {
        // 提交评论到Supabase
        const { error } = await supabase
            .from('comments')
            .insert([
                {
                    message_id: messageId,
                    nickname: nickname || null,
                    content: content
                }
            ]);

        if (error) throw error;

        // 更新评论计数
        const { data: message, error: countError } = await supabase
            .from('messages')
            .select('comments')
            .eq('id', messageId)
            .single();

        if (countError) throw countError;

        const newCommentCount = (message.comments || 0) + 1;

        const { error: updateError } = await supabase
            .from('messages')
            .update({ comments: newCommentCount })
            .eq('id', messageId);

        if (updateError) throw updateError;

        // 更新UI中的评论计数
        const commentCountEl = document.querySelector(`.comment-btn[data-id="${messageId}"] + .comment-count`);
        commentCountEl.textContent = newCommentCount;

        // 重新加载评论（这会替换临时评论）
        await loadComments(messageId);

        // 显示成功消息
        showNotification('评论提交成功！', 'success');

        // 清空表单
        contentInput.value = '';
        nicknameInput.value = '';
    } catch (error) {
        // 移除临时评论
        removeTempComment(messageId, tempComment.id);

        // 显示错误消息
        showNotification(`评论提交失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        button.disabled = false;
        button.textContent = '发表评论';
    }
}

// 添加临时评论到列表顶部
function addTempComment(messageId, comment) {
    const commentsList = document.getElementById(`comments-list-${messageId}`);
    const tempCommentElement = document.createElement('div');
    tempCommentElement.className = 'comment-item temp-comment';
    tempCommentElement.id = `comment-${comment.id}`;
    tempCommentElement.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.nickname}</span>
                    <span class="comment-time">提交中...</span>
                </div>
                <div class="comment-content">${comment.content}</div>
                <div class="comment-status"><i class="fas fa-spinner fa-spin"></i> 正在提交</div>
            `;
    commentsList.insertBefore(tempCommentElement, commentsList.firstChild);
}

// 移除临时评论
function removeTempComment(messageId, commentId) {
    const tempCommentElement = document.getElementById(`comment-${commentId}`);
    if (tempCommentElement) {
        tempCommentElement.remove();
    }
}

// 添加通知样式
const style = document.createElement('style');
style.innerHTML = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 10px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 12px;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(0,0,0,0.15);
            }
            
            .notification.success {
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                border-left: 5px solid #1d8348;
            }
            
            .notification.error {
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                border-left: 5px solid #922b21;
            }
            
            .notification.info {
                background: linear-gradient(135deg, #3498db, #2980b9);
                border-left: 5px solid #1a5276;
            }
            
            .notification i {
                font-size: 1.5rem;
            }
            
            @media (max-width: 768px) {
                .notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: calc(100% - 20px);
                }
            }
        `;
document.head.appendChild(style);