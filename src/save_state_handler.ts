import { indexOf, isInt } from "./util";

const $ = window["jQuery"];


export default class SaveStateHandler {
    tree_widget;
    _supportsLocalStorage: boolean|null;

    constructor(tree_widget) {
        this.tree_widget = tree_widget;
    }

    saveState() {
        const state = JSON.stringify(this.getState());

        if (this.tree_widget.options.onSetStateFromStorage) {
            this.tree_widget.options.onSetStateFromStorage(state);
        }
        else if (this.supportsLocalStorage()) {
            localStorage.setItem(
                this.getCookieName(),
                state
            );
        }
        else if ($.cookie) {
            $.cookie.raw = true;
            $.cookie(
                this.getCookieName(),
                state,
                {path: '/'}
            );
        }
    }

    getStateFromStorage() {
        const json_data = this._loadFromStorage();

        if (json_data) {
            return this._parseState(json_data);
        }
        else {
            return null;
        }
    }

    _parseState(json_data) {
        const state = $.parseJSON(json_data);

        // Check if selected_node is an int (instead of an array)
        if (state && state.selected_node && isInt(state.selected_node)) {
            // Convert to array
            state.selected_node = [state.selected_node];
        }

        return state;
    }

    _loadFromStorage() {
        if (this.tree_widget.options.onGetStateFromStorage) {
            return this.tree_widget.options.onGetStateFromStorage();
        }
        else if (this.supportsLocalStorage()) {
            return localStorage.getItem(
                this.getCookieName()
            );
        }
        else if ($.cookie) {
            $.cookie.raw = true;
            return $.cookie(this.getCookieName());
        }
        else {
            return null;
        }
    }

    getState() {
        const getOpenNodeIds = () => {
            const open_nodes = [];

            this.tree_widget.tree.iterate(
                node => {
                    if (
                        node.is_open &&
                        node.id &&
                        node.hasChildren()
                    ) {
                        open_nodes.push(node.id);
                    }
                    return true;
                }
            );

            return open_nodes;
        }

        const getSelectedNodeIds = () => this.tree_widget.getSelectedNodes().map(n => n.id);

        return {
            open_nodes: getOpenNodeIds(),
            selected_node: getSelectedNodeIds()
        };
    }

    /*
    Set initial state
    Don't handle nodes that are loaded on demand

    result: must load on demand
    */
    setInitialState(state): boolean {
        if (! state) {
            return false;
        }
        else {
            const must_load_on_demand = this._openInitialNodes(state.open_nodes);

            this._selectInitialNodes(state.selected_node);

            return must_load_on_demand;
        }
    }

    _openInitialNodes(node_ids: Array<any>): boolean {
        const must_load_on_demand = false;

        for (let node_id of node_ids) {
            const node = this.tree_widget.getNodeById(node_id);

            if (node) {
                if (! node.load_on_demand) {
                    node.is_open = true;
                }
                else {
                    const must_load_on_demand = true;
                }
            }
        }

        return must_load_on_demand;
    }

    _selectInitialNodes(node_ids: Array<any>): boolean {
        let select_count = 0;

        for (let node_id of node_ids) {
            const node = this.tree_widget.getNodeById(node_id);

            if (node) {
                select_count += 1;

                this.tree_widget.select_node_handler.addToSelection(node);
            }
        }

        return select_count != 0;
    }

    setInitialStateOnDemand(state, cb_finished: Function) {
        if (state) {
            this._setInitialStateOnDemand(state.open_nodes, state.selected_node, cb_finished);
        }
        else {
            cb_finished();
        }
    }

    _setInitialStateOnDemand(node_ids_param: Array<any>, selected_nodes, cb_finished: Function) {
        let loading_count = 0;
        let node_ids = node_ids_param;

        const openNodes = () => {
            const new_nodes_ids = [];

            for (let node_id of node_ids) {
                const node = this.tree_widget.getNodeById(node_id);

                if (! node) {
                    new_nodes_ids.push(node_id);
                }
                else {
                    if (! node.is_loading) {
                        if (node.load_on_demand) {
                            loadAndOpenNode(node);
                        }
                        else {
                            this.tree_widget._openNode(node, false);
                        }
                    }
                }
            }

            node_ids = new_nodes_ids;

            if (this._selectInitialNodes(selected_nodes)) {
                this.tree_widget._refreshElements();
            }

            if (loading_count == 0) {
                cb_finished();
            }
        }

        const loadAndOpenNode = (node: Node) => {
            loading_count += 1;
            this.tree_widget._openNode(
                node,
                false,
                () => {
                    loading_count -= 1;
                    openNodes();
                }
            )
        }

        openNodes();
    }

    getCookieName(): string {
        if (typeof this.tree_widget.options.saveState == 'string') {
            return this.tree_widget.options.saveState;
        }
        else {
            return 'tree';
        }
    }

    supportsLocalStorage(): boolean {
        const testSupport = () => {
            // Is local storage supported?
            if (localStorage == null) {
                return false;
            }
            else {
                // Check if it's possible to store an item. Safari does not allow this in private browsing mode.
                try {
                    const key = '_storage_test';
                    sessionStorage.setItem(key, 'value');
                    sessionStorage.removeItem(key);
                }
                catch (error) {
                    return false;
                }

                return true;
            }
        }

        if (this._supportsLocalStorage == null) {
            this._supportsLocalStorage = testSupport();
        }

        return this._supportsLocalStorage;
    }

    getNodeIdToBeSelected() {
        const state = this.getStateFromStorage();

        if (state && state.selected_node) {
            return state.selected_node[0];
        }
        else {
            return null;
        }
    }
}