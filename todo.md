- [ ] Add cache buffer, an array which stores in memory all the most recent resources.  
1. As a resource is requested, the server first checks to see if it is in the cache. If it is, the cached version is retrieved and there is no need to access the filesystem, either for meta info or the file itself.
2. When the file is requested, it gets added to the top of the cache. If it is already exists in the cache, it is moved to the top. This way, the most popular resources are always in the cache.
3. the `cache_size` config option defines, in megabytes, the size of the cache buffer. The default size will be set to 100MB.
