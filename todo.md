- [ ] Add cache buffer, an array which stores in memory all the most recent resources.  
    1. As a resource is requested, the server first checks to see if it is in the cache. If it is, the cached version is retrieved and there is no need to access the filesystem, either for meta info or the file itself.
    2. When the file is requested, it gets added to the top of the cache. If it is already exists in the cache, it is moved to the top. This way, the most popular resources are always in the cache.
    3. the `cache_size` config option defines, in megabytes, the size of the cache buffer. The default size will be set to 100MB.  
    **NOTE:** It may be a good idea to add a stickiness factor, so that files that are popular over time, as opposed to just popular since the last *x* requests, will stay at the top of the cache.
- [ ] Change option for config file path to `-f` to be more consistent with other cli programs. Alternatively, the long version `--config` should also work.
- [ ] Dynamic root path. There needs to be a way of using a root path which is determined automatically based on the hostname. So, for example, if I access the server at `x.example.com`, it would look at that subdomain (`x`) and direct me to a root path based purely on variable and according to some predefined pattern. This way, you can, for example, quickly set up sandboxed hosts for testing without having to reconfigure the server.
- [ ] Add HTTPS support already!
