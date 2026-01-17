browser.runtime.getBackgroundPage()
.then(_=>_.initOptionsView(window)); // pass the UI view to the background page, see ./background.js
