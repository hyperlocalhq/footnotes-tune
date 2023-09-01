import styles from  './index.pcss';

import { API, BlockTune, BlockAPI } from '@editorjs/editorjs';
import { make } from './dom';
import Popover from './popover';
import Note, { NoteData } from './note';
import IconAddFootnote from './assets/add-footnote.svg';
import Shortcut from '@codexteam/shortcuts';

const DEBOUNCE_DELAY = 500;
/**
 * Type of Footnotes Tune data
 */
export type FootnotesData = NoteData[];

/**
 * Tune user config
 */
export interface FootnotesTuneConfig {
  placeholder?: string;
  shortcut?: string;
}

/**
 * NoteMapper for Editor.js
 */
type NoteMapper = {
  [key:string]: Note;
};

/**
 * NotesForHolders for Editor.js
 */
type NotesForHolders = {
  [key:string]: NoteMapper;
};

/**
 * PopoverMapper for Editor.js
 */
type PopoverMapper = {
  [blockId:string]: Popover;
};

/**
 * A helper to delay event handling
 */
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number): any => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * FootnotesTune for Editor.js
 */
export default class FootnotesTune implements BlockTune {
  /**
   * Specify this is a Block Tune
   */
  public static isTune = true;

  /**
   * Sanitize config for Tune
   */
  public static sanitize = {
    sup: {
      'data-tune': Note.dataAttribute,
      'data-id': true,
    },
  };

  /**
   * Notes
   */
  private static notes: NotesForHolders = {};

  /**
   * Popovers
   */
  private static popovers: PopoverMapper = {};

  /**
   * Tune's wrapper for tools' content
   */
  private wrapper = make('div', styles['ej-fn-wrapper']);

  /**
   * Editable popover for notes
   */
  private popover: Popover;

  /**
   * We need to observe mutations to check if footnote removed
   */
  private observer = new MutationObserver(
    debounce(this.contentDidMutated.bind(this), DEBOUNCE_DELAY)
  );

  /**
   * We need to observe mutations to check if footnote removed
   */
  private intersectionObserver = new IntersectionObserver(
    debounce(this.blocksMoved.bind(this), DEBOUNCE_DELAY)
  );

  /**
   * Data passed on render
   */
  private readonly data: NoteData[] = [];


  /**
   * Editor.js API
   */
  private readonly api: API;

  /**
   * Block
   */
  private block: BlockAPI;

  /**
   * Shortcut instance
   */
  private shortcut: any;

  /**
   * Tune's config
   *
   * @private
   */
  private config: FootnotesTuneConfig;

  /**
   * Shortcut instance
   */
  private holderId: any;

  /**
   * @class
   *
   * @param data - data passed on render
   * @param api - Editor.js API
   * @param config - Tune's config
   */
  constructor({ data, api, block, config = {} }: { data: FootnotesData, api: API, block: BlockAPI, config?: FootnotesTuneConfig }) {
    this.data = data;
    this.api = api;
    this.block = block;
    this.config = config;
    this.popover = new Popover(block, this.wrapper, api, this.config);
    FootnotesTune.popovers[this.block.id] = this.popover;
  }

  /**
   * Render Tune icon
   */
  public render(): HTMLElement {
    const selection = window.getSelection()!;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const tuneWrapper = make('div', styles['ej-fn-tune']);
    const icon = make('div', styles['ej-fn-tune__icon'], {
      innerHTML: IconAddFootnote,
    });
    const label = make('div', styles['ej-fn-tune__label'], {
      innerText: this.api.i18n.t('Footnote'),
    });

    tuneWrapper.appendChild(icon);
    tuneWrapper.appendChild(label);

    if (!range || !this.wrapper.contains(range.startContainer)) {
      tuneWrapper.classList.add(styles['ej-fn-tune--disabled']);
    } else {
      tuneWrapper.addEventListener('click', () => {
        this.onClick(range);
      });
    }

    return tuneWrapper;
  }

  /**
   * Saves notes data
   */
  public save(): FootnotesData {
    const blockNotes = Array.from(this.wrapper.querySelectorAll(`sup[data-tune=${Note.dataAttribute}]`));
    const holderId = this.getHolderId();
    if (!holderId) {
      return this.data;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = {};
    }
    let noteData: NoteData[] = [];
    for (const note of Object.values(FootnotesTune.notes[holderId])) {
      if (blockNotes.includes(note.node)) {
        noteData.push(note.save());
      }
    }
    return noteData;
  }

  /**
   * Wraps plugins content with Tune's own wrapper
   *
   * @param pluginsContent - Tool's content
   */
  public wrap(pluginsContent: HTMLElement): HTMLElement {
    this.wrapper.append(pluginsContent, this.popover.node);

    const timeout = 300;
    setTimeout(() => {
      this.hydrate(pluginsContent);
    }, timeout);

    // At this point, the wrapper is not yet attached to DOM, so
    // this.wrapper.isConnected === false;
    this.observer.observe(this.wrapper, {
      childList: true,
      subtree: true,
    });
    this.intersectionObserver.observe(this.wrapper);

    this.shortcut = new Shortcut({
      on: this.wrapper,
      name: this.config.shortcut || 'CMD+SHIFT+F',
      callback: (): void => {
        const selection = window.getSelection();

        if (!selection) {
          return;
        }

        const range = selection.getRangeAt(0);

        if (!range) {
          return;
        }

        this.onClick(range);
      },
    });

    return this.wrapper;
  }

  /**
   * Tune destory method to clean up
   */
  public destroy(): void {
    this.shortcut?.remove();
  }

  private getHolderId(): string {
    if (!this.holderId) {
      const holder = this.wrapper.closest('[data-editorjs-holder]');
      if (holder) {
        this.holderId = holder.getAttribute('id') || '';
      }
    }
    return this.holderId;
  }

  /**
   * Callback on click on Tunes icon
   *
   * @param range - selected range at Editor zone
   */
  private onClick(range: Range): void {
    range.collapse(false);

    const note = new Note(range, this.popover);

    this.insertNote(note);
    this.popover.open(note);

    this.api.toolbar.toggleBlockSettings(false);
  }

  /**
   * Inserts new note to notes array
   *
   * @param newNote - note to insert
   */
  private insertNote(newNote: Note): void {
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = {};
    }
    FootnotesTune.notes[holderId][newNote.id] = newNote;
  }

  /**
   * Mutation Observer callback
   *
   * @param mutationsList - mutation records array
   */
  private contentDidMutated(mutationsList: MutationRecord[]): void {
    const shouldUpdateIndices = mutationsList.some(record => {
      const supAdded = Array.from(record.addedNodes).some(node => node.nodeName === 'SUP');
      const supRemoved = Array.from(record.removedNodes).some(node => {
        if (!(node instanceof HTMLElement)) {
          return false;
        }
        if (node.nodeName !== 'SUP' || node.dataset.tune !== Note.dataAttribute) {
          return false;
        }

        const holderId = this.getHolderId();
        if (!holderId) {
          return false;
        }
        // keep the mappers until form save, don't
        // delete FootnotesTune.notes[holderId][noteId];

        return true;
      });

      return supAdded || supRemoved;
    });

    /**
     * If sup element was added or removed, we need to update indices
     */
    if (shouldUpdateIndices) {
      this.updateIndices();
    }
  }

  private blocksMoved(): void {
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    const holder = document.getElementById(holderId);
    let shouldUpdateIndices = false;
    let shouldRehydrateAll = false;
    if (holder) {
      let oldBlocksCount = parseInt(holder.dataset.blocksCount || '0', 10);
      let newBlocksCount = this.api.blocks.getBlocksCount();
      holder.dataset.blocksCount = newBlocksCount.toString();
      shouldRehydrateAll = newBlocksCount < oldBlocksCount;

      const sups:NodeListOf<HTMLElement> = holder.querySelectorAll(`sup[data-tune=${Note.dataAttribute}]`);
      for (let i = 0, len = sups.length; i < len; i++) {
        let sup = sups[i];
        if (sup.innerText !== (i + 1).toString()) {
          shouldUpdateIndices = true;
          break;
        }
      }
      if (shouldRehydrateAll) {
        /**
         * Some blocks removed or joined
         */
        const timeout = 300;
        setTimeout(() => {
          this.refreshNotes();
        }, timeout);
      } else if (shouldUpdateIndices) {
        /**
         * If sup text doesn't match the index of it
         */
        this.updateIndices();
      }
    }
  }

  /**
   * Updates notes indices
   */
  private updateIndices(): void {
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = {};
    }
    const holder = document.getElementById(holderId);
    if (holder) {
      const sups:NodeListOf<HTMLElement> = holder.querySelectorAll(`sup[data-tune=${Note.dataAttribute}]`);
      for (let i = 0, len = sups.length; i < len; i++) {
        const sup = sups[i];
        const noteId = sup.dataset.id || '';
        const note = FootnotesTune.notes[holderId][noteId];
        if (note) {
          note.index = i + 1;
        }
      }
    }
  }

  /**
   * Refreshes notes
   */
  private refreshNotes(): void {
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = {};
    }
    const holder = document.getElementById(holderId);
    if (holder) {
      const sups:NodeListOf<HTMLElement> = holder.querySelectorAll(`sup[data-tune=${Note.dataAttribute}]`);
      for (let i = 0, len = sups.length; i < len; i++) {
        const sup = sups[i];
        const noteId = sup.dataset.id || '';
        const note = FootnotesTune.notes[holderId][noteId];
        if (note.node !== sup) {
          note.node = sup;
        }
        note.index = i + 1;
        const blockNode = sup.closest('.ce-block');
        if (blockNode instanceof HTMLElement) {
          const blockId: string = blockNode.dataset.id || '';
          note.updatePopover(FootnotesTune.popovers[blockId]);
          note.listenToClicks();
        }
      }
    }
  }

  /**
   * Hydrate content passed on render
   *
   * @param content - Tool's content
   */
  private hydrate(content: HTMLElement): void {
    /* content might be not yet populated, so we are using a timeout */
    let blockData = this.data || [];
    const sups = content.querySelectorAll(`sup[data-tune=${Note.dataAttribute}]`);
    // console.log("-----");
    // console.log({ "innerHTML": content.innerHTML });
    // console.log({ "query": `sup[data-tune=${Note.dataAttribute}]` });
    // console.log({ "data": data });
    // console.log({ "sups": sups });
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = {};
    }
    sups.forEach((sup, i) => {
      if (sup instanceof HTMLElement) {
        const noteId = sup.dataset.id || '';
        const oldNote = FootnotesTune.notes[holderId][noteId];
        let noteContent = '';
        let index= 0;
        if (oldNote) {
          noteContent = oldNote.content || '';
          index = oldNote.index || 0;
        }
        if (!blockData[i]) {
          blockData[i] = {
            id: noteId,
            content: noteContent,
            superscript: index + 1,
          };
        }
        const newNote = new Note(sup as HTMLElement, this.popover, blockData[i].id);
        newNote.content = blockData[i].content;
        if (FootnotesTune.notes[holderId][newNote.id]) {
          delete FootnotesTune.notes[holderId][newNote.id];
        }
        FootnotesTune.notes[holderId][newNote.id] = newNote;
      }
    });
  }
}

