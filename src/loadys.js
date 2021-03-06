'use strict';

export default class LoadYS {
	constructor(product, module, { axios, fetch, domain, env = 'prod', collect_domain }) {
		this.product = product;
		this.module = module;
		if (typeof fetch !== 'function' && typeof axios !== 'function')
			throw new Error('fetch|axios不可均为空，无法创建对象！');
		this.fetch = fetch;
		this.axios = axios;
		this.collect_domain = collect_domain;

		this.onError = () => {};

		this.domain = domain;
		this.static_domain = domain + (env === 'test' ? 'test_static' : 'static');
		this.release_domain = domain + (env === 'test' ? 'test_release' : 'release');
		this.cache = {};
	}

	init() {
		return this._fetch(
			this.release_domain + '/' + this.product + '/' + this.module + '/index.json',
		).then(indexData => {
			if (!indexData || !indexData.data_list) return this.onError('获取分类错误！');
			this.static_domain = indexData.static_path;
			this.last_update_time = indexData.last_update_time;
			this.category = indexData.data_list.map(item => {
				if (item.preview_list && item.preview_list.length > 0) {
					item.preview_list = item.preview_list.map(k => {
						if (k.file.indexOf('http') < 0) k.file = indexData.static_path + k.file;
						if (k.preview.indexOf('http') < 0)
							k.preview = indexData.static_path + k.preview;
						return k;
					});
				}
				return item;
			});
			return true;
		});
	}

	event(type, file_key) {
		if (
			!type ||
			!file_key ||
			typeof file_key !== 'string' ||
			file_key.split('.').length !== 4 ||
			!this.collect_domain
		)
			return;
		const url =
			this.collect_domain +
			`/j/collect.gif?p=${this.product}&s=${
				this.module
			}&f=${file_key}&t=${type}&u=${encodeURIComponent(window.location.origin)}&r=${parseInt(
				Math.random() * 10000000,
			)}&d=${new Date().getTime()}`;
		let img = new Image();
		img.onload = function () {
			img = null;
		};
		img.src = url;
	}

	_fetch(url) {
		const cache = this.cache[url];
		if (cache) return Promise.resolve(cache);
		if (this.axios && typeof this.axios.get === 'function') {
			return this.axios
				.get(url)
				.then(({ status, data }) => {
					if (status !== 200) throw new Error(`获取状态码错误:${status}`);
					this.cache[url] = data;
					return data;
				})
				.catch(e => {
					this.onError(e);
				});
		}
		return this.fetch({ url, method: 'get' })
			.then(data => {
				if (!data) throw new Error('返回的ysData数据为空！');
				this.cache[url] = data;
				return data;
			})
			.catch(e => {
				this.onError(e);
			});
	}

	/**
	 * 得到所有的分类
	 * @return {[type]} [description]
	 */
	getCategory(name) {
		if (!name) return this.category;
		return this.category.find(k => k.name === name);
	}

	/**
	 * 得到某个分类的第n页的数据
	 * @param  {[type]} category_name [description]
	 * @param  {[type]} options.page  [description]
	 * @return {[type]}               [description]
	 */
	getList(name, { page = 1 } = {}) {
		const d = this.category.find(k => k.name === name);
		if (!d) return this.onError('getList:分类中没有:' + name);
		if (page > d.paths.length) return this.onError('getList:页数无效:' + page);
		return this._fetch(this.release_domain + d.paths[page - 1]).then(data => {
			if (!data || !(data instanceof Array))
				return this.onError(`获取制定页数${page}内容${data}错误！`);
			const static_domain = this.static_domain;
			return data.map(k => {
				if (k.file.indexOf('http') < 0) k.file = static_domain + k.file;
				if (k.preview.indexOf('http') < 0) k.preview = static_domain + k.preview;
				return k;
			});
		});
	}
}
