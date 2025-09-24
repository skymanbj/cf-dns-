class CloudflareDNSManager {
  constructor() {
    this.apiToken = '';
    this.zones = [];
    this.currentZone = null;
    this.records = [];
    this.workers = [];
    this.init();
  }

  init() {
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
    console.log('Binding events...');

    const saveTokenBtn = document.getElementById('save-token');
    if (saveTokenBtn) {
      saveTokenBtn.addEventListener('click', () => {
        console.log('Save token button clicked');
        this.saveTokenAndLoadZones();
      });
    }

    const apiTokenInput = document.getElementById('api-token');
    if (apiTokenInput) {
      apiTokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter key pressed');
          this.saveTokenAndLoadZones();
        }
      });
    }

    const zoneSelect = document.getElementById('zone-select');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (e) => {
        this.selectZone(e.target.value);
      });
    }

    const loadRecordsBtn = document.getElementById('load-records');
    if (loadRecordsBtn) {
      loadRecordsBtn.addEventListener('click', () => {
        console.log('Load records button clicked');
        this.loadRecords();
        this.loadWorkers();
      });
    }
    
    const addRecordBtn = document.getElementById('add-record');
    if (addRecordBtn) {
      addRecordBtn.addEventListener('click', () => this.addRecord());
    }

    const refreshBtn = document.getElementById('refresh-records');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadRecords();
        this.loadWorkers();
      });
    }

    const changeDomainBtn = document.getElementById('change-domain');
    if (changeDomainBtn) {
      changeDomainBtn.addEventListener('click', () => this.changeDomain());
    }
    
    const searchInput = document.getElementById('search-records');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterRecords());
    }

    const filterType = document.getElementById('filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => this.filterRecords());
    }
    
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
    console.log('Loading settings...');
    try {
      const result = await chrome.storage.local.get(['apiToken', 'currentZone']);
      console.log('Settings loaded:', result);
      
      if (result.apiToken) {
        this.apiToken = result.apiToken;
        const apiTokenInput = document.getElementById('api-token');
        if (apiTokenInput) {
          apiTokenInput.value = result.apiToken;
        }
        await this.loadZones();
        
        if (result.currentZone) {
          this.currentZone = result.currentZone;
          const zoneSelect = document.getElementById('zone-select');
          if (zoneSelect) {
            zoneSelect.value = result.currentZone.id;
          }
          await this.loadRecords();
          await this.loadWorkers();
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showMessage('加载设置失败: ' + error.message, 'error');
    }
  }

  async saveTokenAndLoadZones() {
    console.log('Saving token and loading zones...');
    
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

    console.log('Token length:', token.length);

    const saveBtn = document.getElementById('save-token');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    try {
      this.apiToken = token;
      await chrome.storage.local.set({ apiToken: token });
      console.log('Token saved to storage');
      
      await this.loadZones();
    } catch (error) {
      console.error('Error saving token:', error);
      this.showMessage('保存失败: ' + error.message, 'error');
    } finally {
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

    console.log('Loading zones...');
    this.showLoading(true);
    
    try {
      console.log('Fetching zones from Cloudflare API...');
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

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API response:', data);
      
      if (data.success) {
        this.zones = data.result || [];
        console.log(`Loaded ${this.zones.length} zones`);
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
    console.log('Displaying zones...');
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

    console.log('Zones displayed in dropdown');
  }

  selectZone(zoneId) {
    if (!zoneId) {
      this.currentZone = null;
      return;
    }
    
    this.currentZone = this.zones.find(z => z.id === zoneId);
    if (this.currentZone) {
      console.log('Selected zone:', this.currentZone.name);
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

    console.log('Loading records for zone:', this.currentZone.name);
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
          // 打印原始数据以调试
          console.log(`Page ${page} raw records sample:`, data.result.slice(0, 3));
          
          allRecords = [...allRecords, ...data.result];
          hasMore = data.result_info.page < data.result_info.total_pages;
          page++;
        } else {
          throw new Error(data.errors[0]?.message || '加载失败');
        }
      }
      
      this.records = allRecords;
      console.log(`Loaded ${this.records.length} records`);
      
      // 详细分析记录类型
      const typeAnalysis = {};
      const unknownTypes = [];
      
      this.records.forEach(record => {
        // 打印每个记录的实际type字段
        if (!typeAnalysis[record.type]) {
          console.log(`Found record type: "${record.type}" for record:`, {
            id: record.id,
            name: record.name,
            type: record.type,
            content: record.content.substring(0, 50) + '...'
          });
        }
        
        typeAnalysis[record.type] = (typeAnalysis[record.type] || 0) + 1;
        
        // 检查是否有未知类型
        const knownTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'CAA', 'SRV', 'LOC', 
                          'SPF', 'CERT', 'DNSKEY', 'DS', 'NAPTR', 'SMIMEA', 'SSHFP', 
                          'TLSA', 'URI', 'PTR', 'HTTPS', 'SVCB'];
        
        if (!knownTypes.includes(record.type.toUpperCase())) {
          unknownTypes.push({
            type: record.type,
            name: record.name,
            content: record.content
          });
        }
      });
      
      console.log('Record types distribution:', typeAnalysis);
      if (unknownTypes.length > 0) {
        console.log('Unknown record types found:', unknownTypes);
      }
      
      this.displayRecords();
      
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

  async loadWorkers() {
    if (!this.currentZone) return;

    try {
      console.log('Loading workers routes for zone:', this.currentZone.name);
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.currentZone.id}/workers/routes`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.workers = data.result || [];
          console.log(`Loaded ${this.workers.length} worker routes:`, this.workers);
          this.displayWorkers();
        }
      }
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  }

  displayWorkers() {
    const workersSection = document.getElementById('workers-section');
    const workersList = document.getElementById('workers-list');
    
    if (!workersList) return;

    if (this.workers.length === 0) {
      workersSection.style.display = 'none';
      return;
    }

    workersSection.style.display = 'block';
    workersList.innerHTML = '';

    this.workers.forEach(worker => {
      const workerElement = document.createElement('div');
      workerElement.className = 'worker-item';
      workerElement.innerHTML = `
        <div class="worker-pattern">路由: ${worker.pattern}</div>
        <div class="worker-script">
          脚本: ${worker.script || '无'}
          ${worker.enabled !== false ? 
            '<span class="worker-enabled">已启用</span>' : 
            '<span class="worker-disabled">已禁用</span>'}
        </div>
      `;
      workersList.appendChild(workerElement);
    });
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

    // 按显示类型和名称排序（将 Cloudflare Workers 占位记录识别为 WORKER）
    records.sort((a, b) => {
      const typeA = this.getDisplayRecordType(a);
      const typeB = this.getDisplayRecordType(b);
      if (typeA !== typeB) return typeA.localeCompare(typeB);
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
      
      const displayType = this.getDisplayRecordType(record);
      const matchType = !typeFilter || displayType === typeFilter;
      
      return matchSearch && matchType;
    });
    
    this.displayRecords(filtered);
  }

  getRecordTypeColor(type) {
    // 获取记录类型对应的颜色类
    const typeUpper = String(type).toUpperCase();
    const colorMap = {
      'A': 'type-A',
      'AAAA': 'type-AAAA',
      'CNAME': 'type-CNAME',
      'TXT': 'type-TXT',
      'MX': 'type-MX',
      'NS': 'type-NS',
      'CAA': 'type-CAA',
      'SRV': 'type-SRV',
      'LOC': 'type-LOC',
      'SPF': 'type-SPF',
      'CERT': 'type-CERT',
      'DNSKEY': 'type-DNSKEY',
      'DS': 'type-DS',
      'NAPTR': 'type-NAPTR',
      'SMIMEA': 'type-SMIMEA',
      'SSHFP': 'type-SSHFP',
      'TLSA': 'type-TLSA',
      'URI': 'type-URI',
      'PTR': 'type-PTR',
      'HTTPS': 'type-HTTPS',
      'SVCB': 'type-SVCB',
      'WORKER': 'type-WORKER'
    };
    
    return colorMap[typeUpper] || 'type-UNKNOWN';
  }

  createRecordElement(record) {
    const div = document.createElement('div');
    div.className = 'record-item';
    div.id = `record-${record.id}`;
    
    // 获取并验证记录类型
    const displayType = this.getDisplayRecordType(record);
    const typeColorClass = this.getRecordTypeColor(displayType);
    
    // 如果遇到未知类型，在控制台警告
    if (typeColorClass === 'type-UNKNOWN') {
      console.warn('Unknown record type detected:', {
        type: record.type,
        name: record.name,
        content: record.content
      });
    }
    
    div.innerHTML = `
      <div class="record-header">
        <div>
          <span class="record-type ${typeColorClass}">${displayType}</span>
          <span class="record-name">${this.formatRecordName(record.name)}</span>
          ${record.proxied ? '<span class="proxied-badge">CDN</span>' : ''}
          ${record.proxiable === false && !record.proxied ? '<span style="font-size: 11px; color: #999; margin-left: 5px;">(不可代理)</span>' : ''}
        </div>
        <div>
          <button class="edit" data-record-id="${record.id}">编辑</button>
          <button class="delete" data-record-id="${record.id}">删除</button>
        </div>
      </div>
      <div class="record-content">${this.formatContent(record)}</div>
      <div class="record-meta">
        <span>TTL: ${this.formatTTL(record.ttl)}</span>
        ${record.priority !== undefined && record.priority !== null ? `<span>优先级: ${record.priority}</span>` : ''}
        ${record.data && Object.keys(record.data).length > 0 ? `<span>数据: ${this.formatRecordData(record.data)}</span>` : ''}
        <span>修改: ${new Date(record.modified_on).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
      </div>
    `;
    
    div.querySelector('.edit').addEventListener('click', () => this.showEditForm(record.id));
    div.querySelector('.delete').addEventListener('click', () => this.deleteRecord(record.id));
    
    return div;
  }

  formatRecordData(data) {
    // 格式化复杂的data字段
    if (typeof data === 'object') {
      const parts = [];
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          parts.push(`${key}: ${value}`);
        }
      }
      return parts.join(', ');
    }
    return JSON.stringify(data);
  }

  formatRecordName(name) {
    if (!this.currentZone) return name;
    if (name === this.currentZone.name) return '@';
    
    // 移除域名后缀，只保留子域名部分
    const suffix = `.${this.currentZone.name}`;
    if (name.endsWith(suffix)) {
      return name.slice(0, -suffix.length);
    }
    return name;
  }

  formatContent(record) {
    const type = this.getDisplayRecordType(record);
    
    // 根据不同类型格式化内容
    switch(type) {
      case 'WORKER':
        return `由 Cloudflare Workers 管理（占位 ${record.type.toUpperCase()} ${record.content}）`;
      case 'MX':
        return `${record.priority || 0} ${record.content}`;
        
      case 'TXT':
        // TXT记录可能很长，截断显示
        const txtContent = record.content;
        if (txtContent.length > 100) {
          return `"${txtContent.substring(0, 100)}..."`;
        }
        return `"${txtContent}"`;
        
      case 'SRV':
        if (record.data) {
          return `${record.data.priority || 0} ${record.data.weight || 0} ${record.data.port || 0} ${record.data.target || record.content}`;
        }
        return record.content;
        
      case 'CAA':
        if (record.data) {
          return `${record.data.flags || 0} ${record.data.tag || ''} "${record.data.value || ''}"`;
        }
        return record.content;
        
      case 'CERT':
      case 'DNSKEY':
      case 'DS':
      case 'NAPTR':
      case 'SMIMEA':
      case 'SSHFP':
      case 'TLSA':
        if (record.data) {
          return this.formatRecordData(record.data);
        }
        return record.content;
        
      case 'LOC':
        if (record.data) {
          const d = record.data;
          return `${d.lat_degrees || 0}° ${d.lat_minutes || 0}' ${d.lat_seconds || 0}" ${d.lat_direction || 'N'} ` +
                 `${d.long_degrees || 0}° ${d.long_minutes || 0}' ${d.long_seconds || 0}" ${d.long_direction || 'E'} ` +
                 `${d.altitude || 0}m`;
        }
        return record.content;
        
      case 'URI':
        if (record.data) {
          return `${record.data.priority || 0} ${record.data.weight || 0} "${record.data.target || record.content}"`;
        }
        return record.content;
        
      case 'HTTPS':
      case 'SVCB':
        if (record.data) {
          return `${record.data.priority || 0} ${record.data.target || '.'} ${record.data.value || ''}`;
        }
        return record.content;
        
      default:
        // 对于其他类型，直接显示content
        return record.content;
    }
  }

  // 将 Cloudflare 自动为 Workers 添加的占位 A/AAAA 记录识别为 WORKER
  getDisplayRecordType(record) {
    const rawType = String(record.type || 'UNKNOWN').toUpperCase();
    if (this.isWorkerPlaceholderRecord(record)) return 'WORKER';
    return rawType;
  }

  isWorkerPlaceholderRecord(record) {
    if (!record || !record.type || !record.content) return false;
    const typeUpper = String(record.type).toUpperCase();
    const content = String(record.content).trim();
    // Cloudflare 常见的 Workers 占位 IP：A 192.0.2.1 / AAAA 100::
    if (typeUpper === 'AAAA' && content === '100::') return true;
    if (typeUpper === 'A' && (content === '192.0.2.1' || content === '198.51.100.1' || content === '203.0.113.1')) return true;
    return false;
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
    
    const recordType = String(record.type).toUpperCase();
    
    // 根据记录类型显示不同的编辑字段
    let formContent = `
      <div class="form-row">
        <input type="text" id="edit-name-${recordId}" value="${record.name}" placeholder="名称">
        <input type="text" id="edit-content-${recordId}" value="${record.content}" placeholder="内容">
      </div>
      <div class="form-row">
    `;
    
    // 添加特定类型的字段
    if (recordType === 'MX' || recordType === 'SRV') {
      formContent += `<input type="number" id="edit-priority-${recordId}" value="${record.priority || ''}" placeholder="优先级">`;
    }
    
    formContent += `
        <input type="number" id="edit-ttl-${recordId}" value="${record.ttl}" placeholder="TTL (1为自动)">
    `;
    
    if (this.canBeProxied(recordType) && record.proxiable !== false) {
      formContent += `
        <label class="checkbox-label">
          <input type="checkbox" id="edit-proxied-${recordId}" ${record.proxied ? 'checked' : ''}>
          <span>CDN代理</span>
        </label>
      `;
    }
    
    formContent += `
      </div>
      <div class="button-group">
        <button class="save-edit" data-record-id="${recordId}">保存</button>
        <button class="cancel-edit">取消</button>
      </div>
    `;
    
    editForm.innerHTML = formContent;
    recordElement.appendChild(editForm);
    
    editForm.querySelector('.save-edit').addEventListener('click', () => this.updateRecord(recordId));
    editForm.querySelector('.cancel-edit').addEventListener('click', () => this.displayRecords());
  }

  canBeProxied(type) {
    // 只有A、AAAA和CNAME记录可以被代理
    const typeUpper = String(type).toUpperCase();
    return ['A', 'AAAA', 'CNAME'].includes(typeUpper);
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

    // 保留原有的data字段（对于复杂记录类型）
    if (record.data) {
      updatedData.data = record.data;
    }

    const recordType = String(record.type).toUpperCase();

    // 添加优先级（如果需要）
    if (recordType === 'MX' || recordType === 'SRV') {
      const priorityElement = document.getElementById(`edit-priority-${recordId}`);
      if (priorityElement) {
        updatedData.priority = parseInt(priorityElement.value) || 0;
      }
    }

    // 添加代理设置（如果可用）
    if (this.canBeProxied(recordType) && record.proxiable !== false) {
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

    const recordType = String(record.type).toUpperCase();
    const confirmMsg = `确定要删除这条${recordType}记录吗？\n\n名称: ${this.formatRecordName(record.name)}\n内容: ${this.formatContent(record)}`;
    
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
    console.log(`Message [${type}]:`, message);
    
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing DNS Manager');
    dnsManager = new CloudflareDNSManager();
  });
} else {
  console.log('DOM already loaded, initializing DNS Manager');
  dnsManager = new CloudflareDNSManager();
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});