/*
    Andy Matuschak mode! As a plugin! Adapted from kognise's examples!
*/

module.exports = ({ SettingTab }) => {
    class AndyMatuschakSettings extends SettingTab {
        constructor(app, instance, plugin) {
            super(app, instance)
            this.plugin = plugin
        }

        display() {
            super.display()
            this.containerEl.empty()

            const pluginOptions = this.plugin.options

            const headerWidthSetting = this.addTextSetting(
                'Header Width',
                'The width of the rotated header',
                'Example: 32px'
            )

            if (pluginOptions.headerWidth) headerWidthSetting.setValue(pluginOptions.headerWidth)

            headerWidthSetting.onChange(() => {
                pluginOptions.headerWidth = parseInt(headerWidthSetting.getValue().trim())
                this.pluginInstance.saveData(pluginOptions)
            })

            const leafWidthSetting = this.addTextSetting(
                'Leaf Width',
                'The width of a single markdown pane',
                'Example: 700px'
            )

            if (pluginOptions.leafWidth) leafWidthSetting.setValue(pluginOptions.leafWidth)

            leafWidthSetting.onChange(() => {
                pluginOptions.leafWidth = parseInt(leafWidthSetting.getValue().trim())
                this.pluginInstance.saveData(pluginOptions)
            })
        }
    }

    class AndyMatuschakPlugin {
        constructor() {
            this.id = 'andy-matuschak'
            this.name = 'Andy Matuschak Mode'
            this.description = 'Stacks vertically-split workspace panes in a horizontally scrolling layout'
            this.defaultOn = true

            this.app = null
            this.instance = null
            this.options = {
                headerWidth: 36,
                leafWidth: 700
            }
            this.leafIds = {};
        }

        init(app, instance) {
            this.app = app
            this.instance = instance

            this.instance.registerSettingTab(new AndyMatuschakSettings(app, instance, this))
        }

        async onEnable() {
            const options = await this.instance.loadData()
            this.options = options || this.options;

            console.log("[AM] Enabled");

            // console.log(this.app.workspace.layoutReady ? "ready" : "not ready");
            if (this.app.workspace.layoutReady) {
                this.layoutReady();
            }
            else {
                this.app.workspace.on('layout-ready', this.layoutReady);
            }
            this.app.workspace.on('resize', this.recalculateLeaves);
            this.app.workspace.on('file-open', this.focusLeaf);
        }

        async onDisable() {
            console.log("[AM] Disabled");
            document.getElementById('andy-matuschak-css').remove();
            const workspaceEl = this.app.workspace.rootSplit.containerEl;
            workspaceEl.style.overflowX = null;
            const leaves = workspaceEl.querySelectorAll(":scope>div");
            leaves.forEach((leaf, i) => {
                leaf.style.minWidth = null;
                leaf.style.boxShadow = null;
                leaf.style.position = null;
                leaf.style.left = null;
                leaf.style.right = null;
            });

            this.app.workspace.off('resize', this.recalculateLeaves);
            this.app.workspace.off('file-open', this.focusLeaf);
        }

        layoutReady = () => {
            this.app.workspace.rootSplit.containerEl.style.overflowX = "auto";

            // add the css for the sideways titles:
            // let's just paste it in for now and work out 'proper' later
            const css = document.createElement('style');
            css.type = 'text/css';
            css.id = 'andy-matuschak-css';
            css.appendChild(document.createTextNode(`
            /* first we'll add a bit of gap for the title to sit inside of */
            .workspace-leaf-content {
                padding-left: ${this.options.headerWidth}px;
                position: relative;
            }

            /* this is where the magic happens */
            .view-header {
                writing-mode: vertical-lr;
                border-right: 1px solid var(--background-secondary-alt);
                border-left: 2px solid var(--background-secondary-alt);
                border-top: none;
                border-bottom: none;
                height: auto;
                width: ${this.options.headerWidth}px;
                position: absolute;
                left:0;
                top:0;
                bottom:0;
            }

            /* active titles have different border colours */
            .workspace-leaf.mod-active .view-header {
                border-right: 2px solid var(--interactive-accent);
                border-bottom: none;
            }

            /* unset the title container height and swap padding */
            .view-header-title-container {
                height: unset;
                padding-left: unset;
                padding-top: 5px;
            }

            /* fix the long-title-obscuring shadows */
            .view-header-title-container:after {
                width: 100%;
                height: 30px;
                top:unset;
                bottom: 0;
                background: linear-gradient(to bottom, transparent, var(--background-secondary));
            }
            .workspace-leaf.mod-active .view-header-title-container:after {
                background: linear-gradient(to bottom, transparent, var(--background-primary-alt));
            }

            /* swap the padding/margin around for the header and actions icons */
            .view-header-icon, .view-actions {
                padding: 10px 5px;
            }
            .view-action {
                margin: 8px 0;
            }

            /* get rid of the gap left by the now-missing horizontal title */
            .view-content {
                height: 100%;
            }
            `));
            document.getElementsByTagName("head")[0].appendChild(css);

            this.app.workspace.off('layout-ready', this.layoutReady);
            this.recalculateLeaves();
        }

        recalculateLeaves = () => {
            this.leafIds = {};
            console.log("[AM] Recalculate Leaf Positions");
            const workspaceEl = this.app.workspace.rootSplit.containerEl;
            const leaves = workspaceEl.querySelectorAll(":scope>div");
            const leafCount = leaves.length;
            leaves.forEach((leaf,i) => {
                leaf.style.minWidth = (this.options.leafWidth + this.options.headerWidth) + "px";
                leaf.style.boxShadow = "0px 0px 20px 20px rgba(0,0,0,0.25)";
                leaf.style.position = "sticky";
                leaf.style.left = (i * this.options.headerWidth) + "px";
                leaf.style.right = (((leafCount - i - 1) * this.options.headerWidth) - this.options.leafWidth) + "px";
            });
        }

        focusLeaf = (e) => {
            // get back to the leaf which has been andy'd
            let leaf = this.app.workspace.activeLeaf;
            while (leaf != null && leaf.parentSplit != null && leaf.parentSplit != this.app.workspace.rootSplit) {
                leaf = leaf.parentSplit;
            }

            if (leaf != null) {
                // figure out which "number" leaf this is, and where we need to scroll to
                const left = parseInt(leaf.containerEl.style.left);
                const leafNumber = left / this.options.headerWidth;
                const position = (leafNumber * this.options.leafWidth) + left;

                const rootEl = this.app.workspace.rootSplit.containerEl;
                if (rootEl.scrollLeft < position || rootEl.scrollLeft + rootEl.clientWidth > position + leaf.containerEl.clientWidth) {
                    rootEl.scrollTo({ left: position - left, top: 0, behavior: 'smooth' });
                }
            }
        }
    }

    return new AndyMatuschakPlugin()
}
