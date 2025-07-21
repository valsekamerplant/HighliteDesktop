import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { ContextMenuManager } from '../core/managers/game/contextMenuManager';

export class ShiftClickDrop extends Plugin {
    pluginName = 'Shift Click Drop';
    author = 'Valsekamerplant';

    private contextMenuManager = new ContextMenuManager();
    private shiftDown = false;
    private hoveredCell: HTMLElement | null = null;
    private observer: MutationObserver | null = null;

    init(): void {
        this.log('Shift Click Drop initialized');
    }

    start(): void {
        if (!this.settings.enable.value) return;
        this.bindKeyListeners();
        this.startObservingInventory();
    }

    stop(): void {
        this.unbindKeyListeners();
        this.stopObservingInventory();
        this.clearHoverState();
        this.resetDropIntent();
    }

    // ─── Key Handling ────────────────────────────────────────────────────────────

    private bindKeyListeners() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onWindowBlur);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    private unbindKeyListeners() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onWindowBlur);
        document.removeEventListener(
            'visibilitychange',
            this.onVisibilityChange
        );
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Shift' && !this.shiftDown) {
            this.shiftDown = true;
            this.updateDropIntent();
        }
    };

    private onKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
            this.shiftDown = false;
            this.updateDropIntent();
        }
    };

    private onWindowBlur = () => {
        if (this.shiftDown) {
            this.shiftDown = false;
            this.updateDropIntent();
        }
    };

    private onVisibilityChange = () => {
        if (document.hidden && this.shiftDown) {
            this.shiftDown = false;
            this.updateDropIntent();
        }
    };

    // ─── Inventory Hover ─────────────────────────────────────────────────────────

    private startObservingInventory() {
        const invRoot = document.querySelector('.hs-item-table__body');
        if (!invRoot) return;

        // whenever rows/cells change, re‑hook our listeners
        this.observer = new MutationObserver(() => this.hookAllCells());
        this.observer.observe(invRoot, { childList: true, subtree: true });

        this.hookAllCells();
    }

    private stopObservingInventory() {
        this.observer?.disconnect();
        this.observer = null;
        this.unhookAllCells();
    }

    private hookAllCells() {
        // first clear any old handlers
        this.unhookAllCells();

        const cells = document.querySelectorAll<HTMLElement>(
            '.hs-item-table__cell[data-slot]'
        );

        cells.forEach(cell => {
            const onEnter = () => {
                this.hoveredCell = cell;
                this.updateDropIntent();
            };
            const onLeave = () => {
                if (this.hoveredCell === cell) {
                    this.hoveredCell = null;
                    this.updateDropIntent();
                }
            };

            cell.addEventListener('mouseenter', onEnter);
            cell.addEventListener('mouseleave', onLeave);

            // stash so we can clean up later
            (cell as any).__shiftClickDrop = { onEnter, onLeave };
        });
    }

    private unhookAllCells() {
        document
            .querySelectorAll<HTMLElement>('.hs-item-table__cell[data-slot]')
            .forEach(cell => {
                const h = (cell as any).__shiftClickDrop;
                if (h) {
                    cell.removeEventListener('mouseenter', h.onEnter);
                    cell.removeEventListener('mouseleave', h.onLeave);
                    delete (cell as any).__shiftClickDrop;
                }
            });
    }

    // ─── Drop Priority Logic ─────────────────────────────────────────────────────

    private updateDropIntent() {
        // only if shift is held AND you're hovering over a slot with an item
        if (
            this.shiftDown &&
            this.hoveredCell &&
            this.slotHasItem(this.hoveredCell)
        ) {
            this.contextMenuManager.SetInventoryActionMenuPosition('Drop', -1);
        } else {
            this.resetDropIntent();
        }
    }

    private resetDropIntent() {
        this.contextMenuManager.RemoveInventoryActionMenuPosition('Drop');
    }

    private clearHoverState() {
        this.hoveredCell = null;
    }

    private slotHasItem(cell: HTMLElement): boolean {
        // adjust to your data model—here we assume data-item-id is set when filled
        const id = cell.dataset.itemId;
        return !!id && id !== '0';
    }
}
