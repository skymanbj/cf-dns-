class CloudflareDNSManager {
  constructor() {
    this.apiToken = '';
    this.zones = [];
    this.currentZone = null;
    this.records = [];
    this.init();
  }

  init() {
    // 确保DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.bindEvents();
        this.loadSettings();
      });
    } else {
      this.bindEvents();
      this.loadSettings();
    }
  }

  bindEvents() {
    console.log('Binding events...'); // 调试日志

    // API Token相关
    const saveTokenBtn = document.getElementById('save-token');
    if (saveTokenBtn) {
      saveTokenBtn.addEventListener('click', () => {
        console.log('Save token button clicked'); // 调试日志
        this.saveTokenAndLoadZones();
      });
    }

    const apiTokenInput = document.getElementById('api-token');
    if (apiTokenInput) {
      apiTokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter key pressed'); // 调试日志
          this.saveTokenAndLoadZones();
        }
      });
    }

    // Zone选择相关
    const zoneSelect = document.getElementById('zone-select');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (e) => {
        this.selectZone(e.target.value);
      });
    }

    const loadRecordsBtn = document.getElementById('load-records');
    if (loadRecordsBtn) {
      loadRecordsBtn.addEventListener('click', () => {
        console.log('Load records button clicked'); // 调试日志
        this.loadRecords();
      });
    }
    
    // 记录管理相关
    const addRecordBtn = document.getElementById('add-record');
    if (addRecordBtn) {
      addRecordBtn.addEventListener('click', () => this.addRecord());
    }

    const refreshBtn = document.getElementById('refresh-records');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadRecords());
    }

    const changeDomainBtn = document.getElementById('change-domain');
    if (changeDomainBtn) {
      changeDomainBtn.addEventListener('click', () => this.changeDomain());
    }
    
    // 搜索和筛选
    const searchInput = document.getElementById('search-records');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterRecords());
    }

    const filterType = document.getElementById('filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => this.filterRecords());
    }
    
    // 记录类型变化时显示/隐藏优先级字段
    const newType = document.getElementById('new-type');
    if (newType) {
      newType.addEventListener('change', (e) => {
        const priorityField = document.getElementById('new-priority');
        if (priorityField) {
          if (e.target.value === 'MX' || e.target.value === 'SRV') {
            priorityField.style.display = 'block';
            priorityField.required = true;
          } else {
            priorityField.style.display = 'none';
            priorityField.required = false;
          }
        }
      });
    }
  }

  async loadSettings() {
    console.log('Loading settings...'); // 调试日志
    try {
      const result = await chrome.storage.local.get(['apiToken', 'currentZone']);
      console.log('Settings loaded:', result); // 调试日志
      
      if (result.apiToken) {
        this.apiToken = result.apiToken;
        const apiTokenInput = document.getElementById('api-token');
        if (apiTokenInput) {
          apiTokenInput.value = result.apiToken;
        }
        // 自动加载zones
        await this.loadZones();
        
        if (result.currentZone) {
          this.currentZone = result.currentZone;
          const zoneSelect = document.getElementById('zone-select');
          if (zoneSelect) {
            zoneSelect.value = result.currentZone.id;
          }
          await this.loadRecords();
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showMessage('加载设置失败: ' + error.message, 'error');
    }
  }

  async saveTokenAndLoadZones() {
    console.log('Saving token and loading zones...'); // 调试日志
    
    const tokenInput = document.getElementById('api-token');
    if (!tokenInput) {
      console.error('Token input not found');
      return;
    }

    const token = tokenInput.value.trim();
    
    if (!token) {
      this.showMessage('请输入API Token', 'error');
      return;
    }

    console.log('Token length:', token.length); // 调试日志

    // 显示保存中状态
    const saveBtn = document.getElementById('save-token');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      this.apiToken = token;
      await chrome.storage.local.set({ apiToken: token });
      console.log('Token saved to storage'); // 调试日志
      
      await this.loadZones();
    } catch (error) {
      console.error('Error saving token:', error);
      this.showMessage('保存失败: ' + error.message, 'error');
    } finally {
      // 恢复按钮状态
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存并加载域名';
      }
    }
  }

  async loadZones() {
    if (!this.apiToken) {
      console.error('No API token available');
      return;
    }

    console.log('Loading zones...'); // 调试日志
    this.showLoading(true);
    
    try {
      console.log('Fetching zones from Cloudflare API...'); // 调试日志
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/zones?per_page=50',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Response status:', response.status); // 调试日志
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API response:', data); // 调试日志
      
      if (data.success) {
        this.zones = data.result || [];
        console.log(`Loaded ${this.zones.length} zones`); // 调试日志
        this.displayZones();
        
        const zoneSelector = document.getElementById('zone-selector');
        if (zoneSelector) {
          zoneSelector.style.display = 'block';
        }
        
        this.showMessage(`已加载 ${this.zones.length} 个域名`, 'success');
      } else {
        const errorMsg = data.errors && data.errors[0] ? data.errors[0].message : '未知错误';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
      this.showMessage(`加载域名失败: ${error.message}`, 'error');
      
      // 如果是认证错误，清除token
      if (error.message.includes('Invalid') || 
          error.message.includes('Authentication') || 
          error.message.includes('403') ||
          error.message.includes('401')) {
        console.log('Clearing invalid token');
        await chrome.storage.local.remove('apiToken');
        this.apiToken = '';
        this.showMessage('API Token无效，请重新输入', 'error');
      }
    } finally {
      this.showLoading(false);
    }
  }

  displayZones() {
    console.log('Displaying zones...'); // 调试日志
    const select = document.getElementById('zone-select');
    if (!select) {
      console.error('Zone select element not found');
      return;
    }

    select.innerHTML = '<option value="">-- 选择一个域名 --</option>';
    
    this.zones.forEach(zone => {
      const option = document.createElement('option');
      option.value = zone.id;
      option.textContent = zone.name;
      if (zone.status !== 'active') {
        option.textContent += ` (${zone.status})`;
      }
      select.appendChild(option);
    });

    console.log('Zones displayed in dropdown'); // 调试日志
  }

  selectZone(zoneId) {
    if (!zoneId) {
      this.currentZone = null;
      return;
    }
    
    this.currentZone = this.zones.find(z => z.id === zoneId);
    if (this.currentZone) {
      console.log('Selected zone:', this.currentZone.name); // 调试日志
      chrome.storage.local.set({ currentZone: this.currentZone });
    }
  }

  changeDomain() {
    const settingsSection = document.getElementById('settings-section');
    const recordsSection = document.getElementById('records-section');
    
    if (settingsSection) settingsSection.style.display = 'block';
    if (recordsSection) recordsSection.style.display = 'none';
    
    this.currentZone = null;
  }

  async loadRecords() {
    if (!this.currentZone) {
      this.showMessage('请先选择一个域名', 'error');
      return;
    }

    console.log('Loading records for zone:', this.currentZone.name); // 调试日志
    this.showLoading(true);

    try {
      let allRecords = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${this.currentZone.id}/dns_records?page=${page}&per_page=100`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          allRecords = [...allRecords, ...data.result];
          hasMore = data.result_info.page < data.result_info.total_pages;
          page++;
        } else {
          throw new Error(data.errors[0]?.message || '加载失败');
        }
      }
      
      this.records = allRecords;
      console.log(`Loaded ${this.records.length} records`); // 调试日志
      this.displayRecords();
      
      // 显示域名信息
      const currentDomainSpan = document.getElementById('current-domain');
      if (currentDomainSpan) {
        currentDomainSpan.textContent = this.currentZone.name;
      }
      
      const settingsSection = document.getElementById('settings-section');
      const recordsSection = document.getElementById('records-section');
      
      if (settingsSection) settingsSection.style.display = 'none';
      if (recordsSection) recordsSection.style.display = 'block';
      
      this.showMessage(`已加载 ${this.records.length} 条DNS记录`, 'success');
    } catch (error) {
      console.error('Error loading records:', error);
      this.showMessage(`加载记录失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  displayRecords(recordsToShow = null) {
    const records = recordsToShow || this.records;
    const listContainer = document.getElementById('records-list');
    
    if (!listContainer) {
      console.error('Records list container not found');
      return;
    }

    listContainer.innerHTML = '';

    if (records.length === 0) {
      listContainer.innerHTML = '<div class="no-records">没有找到DNS记录</div>';
      return;
    }

    // 按类型和名称排序
    records.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });

    records.forEach(record => {
      const recordElement = this.createRecordElement(record);
      listContainer.appendChild(recordElement);
    });
  }

  filterRecords() {
    const searchInput = document.getElementById('search-records');
    const filterSelect = document.getElementById('filter-type');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const typeFilter = filterSelect ? filterSelect.value : '';
    
    const filtered = this.records.filter(record => {
      const matchSearch = !searchTerm || 
        record.name.toLowerCase().includes(searchTerm) ||
        record.content.toLowerCase().includes(searchTerm);
      
      const matchType = !typeFilter || record.type === typeFilter;
      
      return matchSearch && matchType;
    });
    
    this.displayRecords(filtered);
  }

  createRecordElement(record) {
    const div = document.createElement('div');
    div.className = 'record-item';
    div.id = `record-${record.id}`;
    
    const typeClass = `record-type type-${record.type}`;
    
    div.innerHTML = `
      <div class="record-header">
        <div>
          <span class="${typeClass}">${record.type}</span>
          <span class="record-name">${this.formatRecordName(record.name)}</span>
          ${record.proxied ? '<span class="proxied-badge">CDN</span>' : ''}
        </div>
        <div>
          <button class="edit" data-record-id="${record.id}">编辑</button>
          <button class="delete" data-record-id="${record.id}">删除</button>
        </div>
      </div>
      <div class="record-content">${this.formatContent(record)}</div>
      <div class="record-meta">
        <span>TTL: ${this.formatTTL(record.ttl)}</span>
        ${record.priority ? `<span>优先级: ${record.priority}</span>` : ''}
        <span>修改时间: ${new Date(record.modified_on).toLocaleString('zh-CN')}</span>
      </div>
    `;
    
    // 使用事件委托绑定按钮事件
    div.querySelector('.edit').addEventListener('click', () => this.showEditForm(record.id));
    div.querySelector('.delete').addEventListener('click', () => this.deleteRecord(record.id));
    
    return div;
  }

  formatRecordName(name) {
    if (!this.currentZone) return name;
    if (name === this.currentZone.name) return '@';
    return name.replace(`.${this.currentZone.name}`, '');
  }

  formatContent(record) {
    if (record.type === 'MX') {
      return `${record.priority} ${record.content}`;
    }
    if (record.type === 'TXT') {
      return `"${record.content}"`;
    }
    return record.content;
  }

  formatTTL(ttl) {
    if (ttl === 1) return '自动';
    if (ttl < 60) return `${ttl}秒`;
    if (ttl < 3600) return `${Math.floor(ttl/60)}分钟`;
    if (ttl < 86400) return `${Math.floor(ttl/3600)}小时`;
    return `${Math.floor(ttl/86400)}天`;
  }

  showEditForm(recordId) {
    const record = this.records.find(r => r.id === recordId);
    const recordElement = document.getElementById(`record-${recordId}`);
    
    if (!record || !recordElement) {
      console.error('Record or element not found');
      return;
    }

    if (recordElement.classList.contains('editing')) {
      this.displayRecords();
      return;
    }
    
    recordElement.classList.add('editing');
    
    const editForm = document.createElement('div');
    editForm.className = 'edit-form';
    editForm.innerHTML = `
      <div class="form-row">
        <input type="text" id="edit-name-${recordId}" value="${record.name}" placeholder="名称">
        <input type="text" id="edit-content-${recordId}" value="${record.content}" placeholder="内容">
      </div>
      <div class="form-row">
        ${record.type === 'MX' || record.type === 'SRV' ? 
          `<input type="number" id="edit-priority-${recordId}" value="${record.priority || ''}" placeholder="优先级">` : ''}
        <input type="number" id="edit-ttl-${recordId}" value="${record.ttl}" placeholder="TTL">
        ${this.canBeProxied(record.type) ? `
          <label class="checkbox-label">
            <input type="checkbox" id="edit-proxied-${recordId}" ${record.proxied ? 'checked' : ''}>
            <span>CDN代理</span>
          </label>
        ` : ''}
      </div>
      <div class="button-group">
        <button class="save-edit" data-record-id="${recordId}">保存</button>
        <button class="cancel-edit">取消</button>
      </div>
    `;
    
    recordElement.appendChild(editForm);
    
    // 绑定编辑表单按钮事件
    editForm.querySelector('.save-edit').addEventListener('click', () => this.updateRecord(recordId));
    editForm.querySelector('.cancel-edit').addEventListener('click', () => this.displayRecords());
  }

  canBeProxied(type) {
    return ['A', 'AAAA', 'CNAME'].includes(type);
  }

  async updateRecord(recordId) {
    const record = this.records.find(r => r.id === recordId);
    if (!record) return;
    
    const nameInput = document.getElementById(`edit-name-${recordId}`);
    const contentInput = document.getElementById(`edit-content-${recordId}`);
    const ttlInput = document.getElementById(`edit-ttl-${recordId}`);
    
    if (!nameInput || !contentInput || !ttlInput) {
      console.error('Edit form inputs not found');
      return;
    }

    const updatedData = {
      type: record.type,
      name: nameInput.value,
      content: contentInput.value,
      ttl: parseInt(ttlInput.value) || 1,
    };

    // 添加优先级（如果需要）
    if (record.type === 'MX' || record.type === 'SRV') {
      const priorityElement = document.getElementById(`edit-priority-${recordId}`);
      if (priorityElement) {
        updatedData.priority = parseInt(priorityElement.value) || 0;
      }
    }

    // 添加代理设置（如果可用）
    if (this.canBeProxied(record.type)) {
      const proxiedElement = document.getElementById(`edit-proxied-${recordId}`);
      if (proxiedElement) {
        updatedData.proxied = proxiedElement.checked;
      }
    }

    this.showLoading(true);

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.currentZone.id}/dns_records/${recordId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedData)
        }
      );

      const data = await response.json();
      
      if (data.success) {
        this.showMessage('记录已更新', 'success');
        await this.loadRecords();
      } else {
        throw new Error(data.errors[0]?.message || '更新失败');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      this.showMessage(`更新失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async deleteRecord(recordId) {
    const record = this.records.find(r => r.id === recordId);
    if (!record) return;

    const confirmMsg = `确定要删除记录吗？\n\n类型: ${record.type}\n名称: ${this.formatRecordName(record.name)}\n内容: ${record.content}`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.currentZone.id}/dns_records/${recordId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        this.showMessage('记录已删除', 'success');
        await this.loadRecords();
      } else {
        throw new Error(data.errors[0]?.message || '删除失败');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      this.showMessage(`删除失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async addRecord() {
    const typeSelect = document.getElementById('new-type');
    const nameInput = document.getElementById('new-name');
    const contentInput = document.getElementById('new-content');
    const ttlInput = document.getElementById('new-ttl');
    
    if (!typeSelect || !nameInput || !contentInput || !ttlInput) {
      console.error('Add record form inputs not found');
      return;
    }

    const type = typeSelect.value;
    const name = nameInput.value || '@';
    
    const newRecord = {
      type: type,
      name: name === '@' ? this.currentZone.name : name,
      content: contentInput.value,
      ttl: parseInt(ttlInput.value) || 1,
    };

    // 添加优先级（MX和SRV记录）
    if (type === 'MX' || type === 'SRV') {
      const priorityInput = document.getElementById('new-priority');
      if (priorityInput) {
        const priority = priorityInput.value;
        if (!priority) {
          this.showMessage('MX/SRV记录需要设置优先级', 'error');
          return;
        }
        newRecord.priority = parseInt(priority);
      }
    }

    // 添加代理设置
    if (this.canBeProxied(type)) {
      const proxiedCheckbox = document.getElementById('new-proxied');
      if (proxiedCheckbox) {
        newRecord.proxied = proxiedCheckbox.checked;
      }
    }

    if (!newRecord.content) {
      this.showMessage('请填写记录内容', 'error');
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.currentZone.id}/dns_records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newRecord)
        }
      );

      const data = await response.json();
      
      if (data.success) {
        this.showMessage('记录已添加', 'success');
        // 清空表单
        nameInput.value = '';
        contentInput.value = '';
        ttlInput.value = '1';
        
        const priorityInput = document.getElementById('new-priority');
        if (priorityInput) priorityInput.value = '';
        
        const proxiedCheckbox = document.getElementById('new-proxied');
        if (proxiedCheckbox) proxiedCheckbox.checked = false;
        
        await this.loadRecords();
      } else {
        throw new Error(data.errors[0]?.message || '添加失败');
      }
    } catch (error) {
      console.error('Error adding record:', error);
      this.showMessage(`添加失败: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  showMessage(message, type = 'info') {
    console.log(`Message [${type}]:`, message); // 调试日志
    
    const messageElement = document.getElementById('message');
    if (!messageElement) {
      console.error('Message element not found');
      return;
    }

    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
      messageElement.className = 'message';
      messageElement.style.display = 'none';
    }, 5000);
  }

  showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = show ? 'flex' : 'none';
    }
  }
}

// 初始化管理器
let dnsManager;

// 确保在DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing DNS Manager');
    dnsManager = new CloudflareDNSManager();
  });
} else {
  console.log('DOM already loaded, initializing DNS Manager');
  dnsManager = new CloudflareDNSManager();
}

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// 添加未处理的Promise错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});