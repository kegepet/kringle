# kringle
A basic Node.js web server with support for multiple hosts, security, and extensions.

**NOTE:** **kringle** is a work in progress. It currently has no support for https, but will in the coming weeks. To install kringle, the simlest way is via npm:
```
npm install kringle
```
or
```
sudo npm install --global kringle
```

To daemonize kringle on a Unix-like OS, an init script will have to be created. This is also in the **kringle** todo queue. For now, you can manually start **kringle** by simply running `kringle` from the command line. However, this is not particularly useful for two reasons: One, it will run in the foreground occupying your terminal window, and two, you'll have to start it up each time you want to run it--not very practical for a web server. Instead you can add the following line to your `/etc/rc.local` file to automate **kringle** at startup.
```
su kringleuser -c "/path/to/kringle &"
```
`&` will send the process to the background and is very important, because without it, your computer will hang at startup until the process is complete, which it will not be, because it's a web server.
Please note, however, that `/etc/rc.local` is considered an outdated way to daemonize a process and may not be supported by certain Linux distros. Check your documentation.