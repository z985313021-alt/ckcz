/**
 * WeatherSystem - 独立的天气预报系统组件
 * 包含：右上角实时天气小组件 + 底部 24小时气温折线图面板
 * 依赖：ECharts
 */
class WeatherSystem {
    /**
     * @param {Object} options 配置参数
     * @param {string} options.amapKey 高德地图 Web 服务 Key（用于获取实时天气和逆地理编码）
     * @param {string} options.qweatherKey 和风天气 API Key（用于获取 24 小时预报）
     * @param {string} options.qweatherHost 和风天气请求 Host
     * @param {string} [options.defaultAdcode='110000'] 初始加载的城市 adcode（默认北京）
     * @param {function} [options.onError] 错误回调函数，接收 errorMessage
     */
    constructor(options) {
        if (!options.amapKey || !options.qweatherKey) {
            console.error('WeatherSystem 缺少必要的 API Key 配置！');
            return;
        }

        this.amapKey = options.amapKey;
        this.qweatherKey = options.qweatherKey;
        this.qweatherHost = options.qweatherHost || 'api.qweather.com';
        this.currentAdcode = options.defaultAdcode || '110000';
        this.onError = options.onError || function(err) { alert(err); };
        
        this.weatherChart = null;
        this.refreshIntervalId = null;

        // 图标映射表
        this.iconMap = {
            '晴': '☀️', '多云': '⛅', '阴': '☁️', '阵雨': '🌦️',
            '雷阵雨': '⛈️', '小雨': '🌧️', '中雨': '🌧️', '大雨': '🌧️', '雪': '❄️'
        };

        this._initDOM();
        this._startAutoRefresh();
    }

    // 1. 初始化 DOM 结构并插入到页面
    _initDOM() {
        // 创建实时天气小组件
        const widgetHtml = `
            <div id="ws-weather-widget" class="ws-weather-widget">
                <div class="ws-weather-city" id="ws-weather-city">加载中...</div>
                <div class="ws-weather-main">
                    <div class="ws-weather-temp" id="ws-weather-temp">--°C</div>
                    <div class="ws-weather-icon" id="ws-weather-icon">⌛</div>
                </div>
                <div class="ws-weather-info">
                    <span id="ws-weather-desc">--</span>
                    <span id="ws-weather-wind">--</span>
                </div>
            </div>
        `;

        // 创建 24 小时预报图表面板
        const chartPanelHtml = `
            <div id="ws-weather-chart-panel" class="ws-weather-chart-panel hidden">
                <div class="ws-weather-chart-header">
                    <h3 id="ws-weather-chart-title">24小时天气预报</h3>
                    <button class="ws-close-btn" id="ws-closeWeatherChartBtn">&times;</button>
                </div>
                <div class="ws-weather-chart-container" id="ws-weather-chart-container"></div>
            </div>
        `;

        // 将组件插入到 body 最后
        document.body.insertAdjacentHTML('beforeend', widgetHtml + chartPanelHtml);

        // 绑定关闭事件
        document.getElementById('ws-closeWeatherChartBtn').addEventListener('click', () => {
            document.getElementById('ws-weather-chart-panel').classList.add('hidden');
        });
    }

    // 2. 开启实时天气定时刷新 (10分钟)
    _startAutoRefresh() {
        this.fetchRealTimeWeather();
        this.refreshIntervalId = setInterval(() => {
            this.fetchRealTimeWeather();
        }, 10 * 60 * 1000);
    }

    /**
     * 3. 获取并更新实时天气（高德API）
     */
    async fetchRealTimeWeather() {
        const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${this.amapKey}&city=${this.currentAdcode}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === '1' && data.lives && data.lives.length > 0) {
                const live = data.lives[0];
                let displayCity = live.city;
                if (!displayCity || displayCity.length === 0) displayCity = live.province;

                document.getElementById('ws-weather-city').innerText = displayCity;
                document.getElementById('ws-weather-temp').innerText = live.temperature + '°C';
                document.getElementById('ws-weather-desc').innerText = live.weather;
                document.getElementById('ws-weather-wind').innerText = live.winddirection + '风 ' + live.windpower + '级';
                document.getElementById('ws-weather-icon').innerText = this.iconMap[live.weather] || '⛅';
            }
        } catch (err) {
            console.error('获取实时天气失败:', err);
            document.getElementById('ws-weather-city').innerText = '天气获取失败';
        }
    }

    /**
     * 4. 对外暴露的 API：通过经纬度查询天气
     * （会自动更新实时天气小组件位置，并弹出 24 小时预报折线图）
     * @param {number|string} lon 经度
     * @param {number|string} lat 纬度
     */
    async queryByLocation(lon, lat) {
        // 第一步：更新实时天气小组件的定位
        await this._updateLocationByLonLat(lon, lat);

        // 第二步：获取 24 小时预报并渲染 ECharts
        await this._fetchAndShow24hWeather(lon, lat);
    }

    // 内部方法：高德逆地理编码
    async _updateLocationByLonLat(lon, lat) {
        const url = `https://restapi.amap.com/v3/geocode/regeo?location=${lon},${lat}&key=${this.amapKey}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === '1' && data.regeocode && data.regeocode.addressComponent) {
                this.currentAdcode = data.regeocode.addressComponent.adcode;
                this.fetchRealTimeWeather(); // 立刻刷新小组件
            }
        } catch (e) {
            console.error("高德逆地理编码失败:", e);
        }
    }

    // 内部方法：获取和风 24 小时预报
    async _fetchAndShow24hWeather(lon, lat) {
        const locationStr = `${Number(lon).toFixed(2)},${Number(lat).toFixed(2)}`;
        const url = `https://${this.qweatherHost}/v7/weather/24h?location=${locationStr}&key=${this.qweatherKey}`;

        const panel = document.getElementById('ws-weather-chart-panel');
        const container = document.getElementById('ws-weather-chart-container');
        const title = document.getElementById('ws-weather-chart-title');

        try {
            if (!this.weatherChart) {
                if (typeof echarts === 'undefined') {
                    this.onError('检测不到 ECharts，请确保已引入 echarts.js！');
                    return;
                }
                this.weatherChart = echarts.init(container);
                window.addEventListener('resize', () => this.weatherChart.resize());
            }

            this.weatherChart.showLoading({ text: '正在获取预报数据...' });
            panel.classList.remove('hidden');
            
            // 强制触发一次 resize，防止从隐藏状态切换到显示时，容器尺寸为 0 导致白板
            setTimeout(() => {
                this.weatherChart.resize();
            }, 50);

            title.innerText = `经纬度 [${Number(lon).toFixed(2)}, ${Number(lat).toFixed(2)}] 24小时预报`;

            const response = await fetch(url);
            const data = await response.json();
            this.weatherChart.hideLoading();

            if (data.code === '200') {
                this._renderChart(data.hourly);
            } else {
                this.onError('和风天气返回错误码: ' + data.code);
                panel.classList.add('hidden');
            }
        } catch (err) {
            console.error('天气预报请求异常:', err);
            if (this.weatherChart) this.weatherChart.hideLoading();
            this.onError('请求天气数据时发生异常，请检查网络。');
            panel.classList.add('hidden');
        }
    }

    // 内部方法：渲染 ECharts 折线图
    _renderChart(hourlyData) {
        const times = hourlyData.map(item => {
            const date = new Date(item.fxTime);
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        const temps = hourlyData.map(item => parseInt(item.temp));
        const texts = hourlyData.map(item => item.text);

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const idx = params[0].dataIndex;
                    return `${times[idx]}<br/>温度: ${temps[idx]}°C<br/>天气: ${texts[idx]}`;
                }
            },
            grid: { top: '15%', left: '10%', right: '10%', bottom: '15%' },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: times,
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ddd' } }
            },
            yAxis: {
                type: 'value',
                name: '温度 (°C)',
                axisLabel: { formatter: '{value} °C', color: '#666' },
                splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
            },
            series: [{
                name: '气温',
                type: 'line',
                data: temps,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#ff7e5f' },
                lineStyle: {
                    width: 3,
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#ff7e5f' },
                        { offset: 1, color: '#feb47b' }
                    ])
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(255, 126, 95, 0.5)' },
                        { offset: 1, color: 'rgba(254, 180, 123, 0.05)' }
                    ])
                },
                label: { show: true, position: 'top', formatter: '{c}°C' }
            }]
        };
        // 再次强制调整尺寸确保能填满容器
        this.weatherChart.resize();
        this.weatherChart.setOption(option);
    }
}
