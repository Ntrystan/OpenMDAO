// <<hpp_insert gen/Layout.js>>

/**
 * Manage all components of the application. The model data, the CSS styles, the
 * user interface, the layout of the matrix, and the matrix grid itself are
 * all member objects.
 * @typedef Diagram
 * @property {ModelData} model Processed model data received from Python.
 * @property {N2Style} style Manages N2-related styles and functions.
 * @property {N2Layout} layout Sizes and positions of visible elements.
 * @property {N2Matrix} matrix Manages the grid of visible model parameters.
 * @property {TreeNode} zoomedElement The element the diagram is currently based on.
 * @property {TreeNode} zoomedElementPrev Reference to last zoomedElement.
 * @property {Object} dom Container for references to web page elements.
 * @property {Object} dom.svgDiv The div containing the SVG element.
 * @property {Object} dom.svg The SVG element.
 * @property {Object} dom.svgStyle Object where SVG style changes can be made.
 * @property {Object} dom.toolTip Div to display tooltips.
 * @property {Object} dom.n2OuterGroup The outermost div of N2 itself.
 * @property {Object} dom.n2Groups References to <g> SVG elements.
 * @property {number} chosenCollapseDepth The selected depth from the drop-down.
 */
class Diagram {
    constructor(modelJSON) {
        this.modelData = modelJSON;
        this.model = new OmModelData(modelJSON);
        this.zoomedElement = this.zoomedElementPrev = this.model.root;
        this.manuallyResized = false; // If the diagram has been sized by the user

        // Assign this way because defaultDims is read-only.
        this.dims = JSON.parse(JSON.stringify(defaultDims)); // TODO: Pull solver out of defaults
        this._referenceD3Elements();
        this.transitionStartDelay = N2TransitionDefaults.startDelay;
        this.chosenCollapseDepth = -1;
        this.style = new N2Style(this.dom.svgStyle, this.dims.size.font);
        this.layout = this._newLayout();

        this.search = new N2Search(this.zoomedElement, this.model.root);
        this.ui = new N2UserInterface(this);

        // Keep track of arrows to show and hide them
        this.arrowMgr = new N2ArrowManager(this.dom.n2Groups);
        this.matrix = new N2Matrix(this.model, this.layout, this.dom.n2Groups,
            this.arrowMgr, true, this.ui.findRootOfChangeFunction);
    }

    /**
     * Setup internal references to D3 objects so we can avoid running
     * d3.select() over and over later.
     */
     _referenceD3Elements() {
        this.dom = {
            'svgDiv': d3.select("#svgDiv"),
            'svg': d3.select("#svgId"),
            'svgStyle': d3.select("#svgId style"),
            'toolTip': d3.select(".tool-tip"),
            'arrowMarker': d3.select("#arrow"),
            'n2OuterGroup': d3.select('g#n2outer'),
            'n2InnerGroup': d3.select('g#n2inner'),
            'pTreeGroup': d3.select('g#tree'),
            'highlightBar': d3.select('g#highlight-bar'),
            'n2BackgroundRect': d3.select('g#n2inner rect'),
            'waiter': d3.select('#waiting-container'),
            'clips': {
                'partitionTree': d3.select("#partitionTreeClip > rect"),
                'n2Matrix': d3.select("#n2MatrixClip > rect"),
            }
        };

        const n2Groups = {};
        this.dom.n2InnerGroup.selectAll('g').each(function () {
            const d3elem = d3.select(this);
            const name = new String(d3elem.attr('id')).replace(/n2/, '');
            n2Groups[name] = d3elem;
        })
        this.dom.n2Groups = n2Groups;

        const offgrid = {};
        this.dom.n2OuterGroup.selectAll('g.offgridLabel').each(function () {
            const d3elem = d3.select(this);
            const name = new String(d3elem.attr('id')).replace(/n2/, '');
            offgrid[name] = d3elem;
        })
        this.dom.n2Groups.offgrid = offgrid;
    }

    /** Create a Layout object. Can be overridden to create different types of Layouts */
    _newLayout() {
        return new Layout(this.model, this.zoomedElement, this.dims);
    }

    /**
     * Save the SVG to a filename selected by the user.
     * TODO: Use a proper file dialog instead of a simple prompt.
     */
     saveSvg() {
        let svgData = this.dom.svg.node().outerHTML;

        // Add name spaces.
        if (!svgData.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            svgData = svgData.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!svgData.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
            svgData = svgData.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }

        // Add XML declaration
        svgData = '<?xml version="1.0" standalone="no"?>\r\n' + svgData;

        svgData = vkbeautify.xml(svgData);
        const svgBlob = new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8"
        });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        const svgFileName = prompt("Filename to save SVG as", 'partition_tree_n2.svg');
        downloadLink.download = svgFileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    /**
     * Recurse and pull state info from model for saving.
     * @param {Array} dataList Array of objects with state info for each node.
     * @param {OmTreeNode} node The current node being examined.
     */
     getSubState(dataList, node = this.model.root) {
        if (node.isFilter()) return; // Ignore state for N2FilterNodes

        dataList.push(node.getStateForSave());

        if (node.hasChildren()) {
            for (const child of node.children) {
                this.getSubState(dataList, child);
            }
        }
    }

    /**
     * Recurse and set state info into model.
     * @param {Array} dataList Array of objects with state info for each node. 
     * @param {OmTreeNode} node The node currently being restored.
     */
    setSubState(dataList, node = this.model.root) {
        if (node.isFilter()) return; // Ignore state for N2FilterNodes

        node.setStateFromLoad(dataList.pop());

        // Get rid of any existing filters before processing children, as they'll
        // be populated while processing the state of each child node.
        if (node.hasFilters()) {
            node.filter.inputs.wipe();
            node.filter.outputs.wipe();
        }

        if (node.hasChildren()) {
            for (const child of node.children) {
                this.setSubState(dataList, child);
            }
        }
    }

    /**
     * Replace the current zoomedElement, but preserve its value.
     * @param {Object} newZoomedElement Replacement zoomed element.
     */
    updateZoomedElement(newZoomedElement) {
        this.zoomedElementPrev = this.zoomedElement;
        this.zoomedElement = newZoomedElement;
        this.layout.zoomedElement = this.zoomedElement;
    }

    leftClickSelector(obj, node) {
        switch (this.ui.click.clickEffect) {
            case N2Click.ClickEffect.NodeInfo:
                this.ui.nodeInfoBox.pin();
                break;
            case N2Click.ClickEffect.Collapse:
                this.ui.rightClick(node, obj);
                break;
            case N2Click.ClickEffect.Filter:
                const color = d3.select(obj).select('rect').style('fill');
                this.ui.altRightClick(node, color);
                break;
            default:
                this.ui.leftClick(node);
        }
    }

    _updateScale() {
        this.layout.updateScaleValues();

        if (this.layout.scales.firstRun) { // first run, duplicate what we just calculated
            this.layout.scales.firstRun = false;
            this.layout.preservePreviousScaleValues();

            // Update svg dimensions before size changes
            const outerDims = this.layout.newOuterDims();
            const innerDims = this.layout.newInnerDims();
            const size = this.dims.size;

            this.dom.svgDiv
                .style("width", outerDims.width + size.unit)
                .style("height", outerDims.height + size.unit);

            this.dom.svg
                .attr("width", outerDims.width)
                .attr("height", outerDims.height)
                .attr("transform", "translate(0,0)");

            this.dom.pTreeGroup
                .attr("height", innerDims.height)
                .attr("width", size.partitionTree.width)
                .attr("transform", `translate(0,${innerDims.margin})`);

            this.dom.highlightBar
                .attr("height", innerDims.height)
                .attr("width", "8")
                .attr("transform", `translate(${size.partitionTree.width + 1},${innerDims.margin})`);

            this.dom.n2OuterGroup
                .attr("height", outerDims.height)
                .attr("width", outerDims.height)
                .attr("transform", `translate(${size.partitionTree.width},0)`);

            this.dom.n2InnerGroup
                .attr("height", innerDims.height)
                .attr("width", innerDims.height)
                .attr("transform", `translate(${innerDims.margin},${innerDims.margin})`)
                .transition(sharedTransition);

            this.dom.n2BackgroundRect
                .attr("width", innerDims.height)
                .attr("height", innerDims.height)
                .attr("transform", "translate(0,0)");

            const offgridHeight = size.font + 2;
            this.dom.n2Groups.offgrid.top
                .attr("transform", `translate(${innerDims.margin},0)`)
                .attr("width", innerDims.height)
                .attr("height", offgridHeight);

            this.dom.n2Groups.offgrid.bottom
                .attr("transform", `translate(0,${innerDims.height + offgridHeight})`)
                .attr("width", outerDims.height)
                .attr("height", offgridHeight);

            return true;
        }

        return false;
    }

    _createPartitionCells() {
        const self = this; // For callbacks that change "this". Alternative to using .bind().
        const scale = this.layout.scales.model.prev;
        const transitCoords = this.layout.transitCoords.model.prev;        

        const selection = this.dom.pTreeGroup.selectAll(".partition_group")
            .data(this.layout.zoomedNodes, function (node) {
                return node.id;
            });

        // Create a new SVG group for each node in zoomedNodes
        const nodeEnter = selection.enter()
            .append("g")
            .attr("class", d => `partition_group ${self.style.getNodeClass(d)}`)
            .attr("transform", d =>
                `translate(${scale.x(d.draw.prevDims.x)},${scale.y(d.draw.prevDims.y)})`)
            .on("click", d => self.leftClickSelector(this, d))
            .on("contextmenu", function(d) {
                if (d3.event.altKey) {
                    const color = d3.select(this).select('rect').style('fill');
                    self.ui.altRightClick(d, color);
                }
                else {
                    self.ui.rightClick(d, this);
                }
            })
            .on("mouseover", function(d) {
                self.ui.nodeInfoBox.update(d3.event, d, d3.select(this).select('rect').style('fill'))
            })
            .on("mouseleave", () => self.ui.nodeInfoBox.clear())
            .on("mousemove", () => self.ui.nodeInfoBox.moveNearMouse(d3.event));

        nodeEnter.append("rect")
            .attr("width", d => d.draw.prevDims.width * transitCoords.x)
            .attr("height", d => d.draw.prevDims.height * transitCoords.y)
            .attr("id", d => OmTreeNode.pathToId(d.path))
            .attr('rx', 12)
            .attr('ry', 12);

        nodeEnter.append("text")
            .attr("dy", ".35em")
            .attr("transform", d => {
                const anchorX = d.draw.prevDims.width * transitCoords.x -
                    self.layout.size.rightTextMargin;
                return `translate(${anchorX},${(d.draw.prevDims.height * transitCoords.y / 2)})`;
            })
            .style("opacity", d => (d.depth < self.zoomedElement.depth)? 0 : d.textOpacity)
            .text(self.layout.getText.bind(self.layout));

        return {
            'selection': selection,
            'nodeEnter': nodeEnter
        };
    }

    _setupPartitionTransition(d3Refs) {
        const self = this; // For callbacks that change "this". Alternative to using .bind().
        const scale = this.layout.scales.model;
        const transitCoords = this.layout.transitCoords.model;

        this.dom.clips.partitionTree
            .transition(sharedTransition)
            .attr('height', this.dims.size.partitionTree.height);

        const nodeUpdate = d3Refs.nodeEnter.merge(d3Refs.selection)
            .transition(sharedTransition)
            .attr("class", d => `partition_group ${self.style.getNodeClass(d)}`)
            .attr("transform", d => `translate(${scale.x(d.draw.dims.x)},${scale.y(d.draw.dims.y)})`);

        nodeUpdate.select("rect")
            .attr("width", d => d.draw.dims.width * transitCoords.x)
            .attr("height", d => d.draw.dims.height * transitCoords.y)
            .attr('rx', 12)
            .attr('ry', 12);

        nodeUpdate.select("text")
            .attr("transform", d => {
                const anchorX = d.draw.dims.width * transitCoords.x -
                    self.layout.size.rightTextMargin;
                return `translate(${anchorX},${(d.draw.dims.height * transitCoords.y/2)})`;
            })
            .style("opacity", d => (d.depth < self.zoomedElement.depth)? 0 : d.textOpacity)
            .text(self.layout.getText.bind(self.layout));
    }

    _runPartitionTransition(selection) {
        const self = this; // For callbacks that change "this". Alternative to using .bind().
        const scale = this.layout.scales.model; 
        const transitCoords = this.layout.transitCoords.model;

        // Transition exiting nodes to the parent's new position.
        const nodeExit = selection.exit().transition(sharedTransition)
            .attr("transform", d => `translate(${scale.x(d.draw.dims.x)},${scale.y(d.draw.dims.y)})`)
            .remove();

        nodeExit.select("rect")
            .attr("width", d => d.draw.dims.width * transitCoords.x)
            .attr("height", d => d.draw.dims.height * transitCoords.y);

        nodeExit.select("text")
            .attr("transform", d => {
                const anchorX = d.draw.dims.width * transitCoords.x -
                    self.layout.size.rightTextMargin;
                return `translate(${anchorX},${(d.draw.dims.height * transitCoords.y / 2)})`;
            })
            .style("opacity", 0);
    }

    /** Remove all rects in the highlight bar */
    clearHighlights() {
        const selection = this.dom.highlightBar.selectAll('rect');
        const size = selection.size();
        debugInfo(`clearHighlights: Removing ${size} highlights`);
        selection.remove();
    }

    /** Remove all pinned arrows */
    clearArrows() {
        this.arrowMgr.removeAllPinned();
        this.clearHighlights();
    }

    /** Display connection arrows for all visible inputs/outputs */
    showAllArrows() {
        for (const row in this.matrix.grid) {
            const cell = this.matrix.grid[row][row]; // Diagonal cells only
            this.matrix.drawOnDiagonalArrows(cell);
            this.arrowMgr.togglePin(cell.id, true);
        }
    }

    delay(time) {
        return new Promise(function(resolve) {
            setTimeout(resolve, time)
        });
     }

    /** Display an animation while the transition is in progress */
    showWaiter() { this.dom.waiter.attr('class', 'show'); }

    /** Hide the animation after the transition completes */
    hideWaiter() { this.dom.waiter.attr('class', 'no-show'); }

    /** Add HTML elements coupled to the visible nodes in the model tree. */
    _newTreeCells() {
        const d3PartRefs = this._createPartitionCells();
        this._setupPartitionTransition(d3PartRefs);
        this._runPartitionTransition(d3PartRefs.selection);
    }

    /**
     * Refresh the diagram when something has visually changed.
     * @param {Boolean} [computeNewTreeLayout = true] Whether to rebuild the layout and
     *  matrix objects.
     */
    async update(computeNewTreeLayout = true) {
        this.showWaiter();
        await this.delay(100);

        this.ui.update();
        this.search.update(this.zoomedElement, this.model.root);

        // Compute the new tree layout if necessary.
        if (computeNewTreeLayout) {
            this.layout = this._newLayout();
            this.ui.updateClickedIndices();
            this.matrix = new N2Matrix(this.model, this.layout,
                this.dom.n2Groups, this.arrowMgr, this.ui.lastClickWasLeft,
                this.ui.findRootOfChangeFunction, this.matrix.nodeSize);
        }

        this._updateScale();
        this.layout.updateTransitionInfo(this.dom, this.transitionStartDelay, this.manuallyResized);
        this._newTreeCells();
        this.arrowMgr.transition(this.matrix);
        this.matrix.draw();

        if (!d3.selection.prototype.transitionAllowed) this.hideWaiter();
    }

    /**
     * Updates the intended dimensions of the diagrams and font, but does
     * not perform rendering itself.
     * @param {number} height The base height of the diagram without margins.
     * @param {number} fontSize The new size of the font.
     */
     updateSizes(height, fontSize) {
        let gapSize = fontSize + 4;

        this.dims.size.n2matrix.margin = gapSize;
        this.dims.size.partitionTreeGap = gapSize;

        this.dims.size.n2matrix.height =
            this.dims.size.n2matrix.width = // Match base height, keep it looking square
            this.dims.size.partitionTree.height = height;

        this.dims.size.font = fontSize;
    }

    /**
     * Adjust the height and corresponding width of the diagram based on user input.
     * @param {number} height The new height in pixels.
     */
     verticalResize(height) {
        // Don't resize if the height didn't actually change:
        if (this.dims.size.partitionTree.height == height) return;

        if (!this.manuallyResized) {
            height = this.layout.calcFitDims().height;
        }

        this.updateSizes(height, this.dims.size.font);

        N2TransitionDefaults.duration = N2TransitionDefaults.durationFast;
        this.update();
    }

    /**
     * Adjust the font size of all text in the diagram based on user input.
     * @param {number} fontSize The new font size in pixels.
     */
     fontSizeSelectChange(fontSize) {
        N2TransitionDefaults.duration = N2TransitionDefaults.durationFast;
        this.style.updateSvgStyle(fontSize);
        this.update();
    }

    /**
     * Since the matrix can be destroyed and recreated, use this to invoke the callback
     * rather than setting one up that points directly to a specific matrix.
     * @param {N2MatrixCell} cell The cell the event occured on.
     */
    mouseOverOnDiagonal(cell) {
        if (this.matrix.cellExists(cell)) {
            this.matrix.mouseOverOnDiagonal(cell);
            this.ui.nodeInfoBox.update(d3.event, cell.obj, cell.color());
        }
    }

    /**
     * Move the node info panel around if it's visible
     * @param {N2MatrixCell} cell The cell the event occured on.
     */
    mouseMoveOnDiagonal(cell) {
        if (this.matrix.cellExists(cell)) {
            this.ui.nodeInfoBox.moveNearMouse(d3.event);
        }
    }

    /**
     * Since the matrix can be destroyed and recreated, use this to invoke the callback
     * rather than setting one up that points directly to a specific matrix.
     */
    mouseOverOffDiagonal(cell) {
        if (this.matrix.cellExists(cell)) {
            this.matrix.mouseOverOffDiagonal(cell);
        }
    }

    /** When the mouse leaves a cell, remove all temporary arrows and highlights. */
    mouseOut() {
        this.arrowMgr.removeAllHovered();
        this.clearHighlights();
        d3.selectAll("div.offgrid").style("visibility", "hidden").html('');

        this.ui.nodeInfoBox.clear();
    }

    /**
     * When the mouse is left-clicked on a cell, change their CSS class
     * so they're not removed when the mouse moves out. Or, if in info panel
     * mode, pin the info panel.
     * @param {N2MatrixCell} cell The cell the event occured on.
     */
    mouseClick(cell) {
        if (this.ui.click.isNormal) { // If not in info-panel mode, pin/unpin arrows
            this.arrowMgr.togglePin(cell.id);
        }
        else { // Make a persistent info panel
            this.ui.nodeInfoBox.pin();
        }
    }

    /**
     * Place member mouse callbacks in an object for easy reference.
     * @returns {Object} Object containing each of the functions.
     */
    getMouseFuncs() {
        const self = this;

        const mf = {
            'overOffDiag': self.mouseOverOffDiagonal.bind(self),
            'overOnDiag': self.mouseOverOnDiagonal.bind(self),
            'moveOnDiag': self.mouseMoveOnDiagonal.bind(self),
            'out': self.mouseOut.bind(self),
            'click': self.mouseClick.bind(self)
        }

        return mf;
    }

    /**
     * Set the new depth to collapse to and perform the operation.
     * @param {Number} depth If the node's depth is the same or more, collapse it.
     */
     minimizeToDepth(depth) {
        this.chosenCollapseDepth = depth;

        if (depth > this.zoomedElement.depth)
            this.model.minimizeToDepth(this.model.root, depth);
    }

    /** Unset all manually-selected node states and zoom to the root element */
    reset() {
        this.model.resetAllHidden([]);
        this.updateZoomedElement(this.model.root);
        N2TransitionDefaults.duration = N2TransitionDefaults.durationFast;
        this.update();
    }

    /**
     * Using an object populated by loading and validating a JSON file, set the model
     * to the saved view.
     * @param {Object} oldState The model view to restore.
     */
     restoreSavedState(oldState) {
        // Zoomed node (subsystem).
        this.zoomedElement = this.nodeIds[oldState.zoomedElement];

        // Expand/Collapse state of all nodes (subsystems) in model.
        this.setSubState(oldState.expandCollapse.reverse());

        // Force an immediate display update.
        // Needed to do this so that the arrows don't slip in before the element zoom.
        this.layout = this._newLayout();
        this.ui.updateClickedIndices();
        this.matrix = new N2Matrix(this.model, this.layout,
            this.dom.n2Groups, this.arrowMgr, this.ui.lastClickWasLeft,
            this.ui.findRootOfChangeFunction, this.matrix.nodeSize);
        this._updateScale();
        this.layout.updateTransitionInfo(this.dom, this.transitionStartDelay, this.manuallyResized);

        // Arrow State
        this.arrowMgr.loadPinnedArrows(oldState.arrowState);
    }
}
 