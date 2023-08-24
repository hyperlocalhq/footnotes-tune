import styles from  './index.pcss';

import { API, BlockTune, BlockAPI } from '@editorjs/editorjs';
import { make } from './dom';
import Popover from './popover';
import Note, {NoteData} from './note';
import IconAddFootnote from './assets/add-footnote.svg';
import Shortcut from '@codexteam/shortcuts';

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

type NotesForHolders = {
  [key:string]: Note[];
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
  private observer = new MutationObserver(this.contentDidMutated.bind(this));

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
      FootnotesTune.notes[holderId] = [];
    }
    return FootnotesTune.notes[holderId].filter(note => blockNotes.includes(note.node)).map(note => note.save());
  }

  /**
   * Wraps plugins content with Tune's own wrapper
   *
   * @param pluginsContent - Tool's content
   */
  public wrap(pluginsContent: HTMLElement): HTMLElement {
    this.wrapper.append(pluginsContent, this.popover.node);

    this.hydrate(pluginsContent);

    this.observer.observe(this.wrapper, {
      childList: true,
      subtree: true,
    });

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
      FootnotesTune.notes[holderId] = [];
    }
    let nextNoteIndex = FootnotesTune.notes[holderId].findIndex(note =>
      newNote.range.compareBoundaryPoints(Range.START_TO_START, note.range) === -1
    );

    if (nextNoteIndex === -1) {
      nextNoteIndex = FootnotesTune.notes[holderId].length;
    }

    FootnotesTune.notes[holderId].splice(nextNoteIndex, 0, newNote);
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
        if (node.nodeName !== 'SUP') {
          return false;
        }

        const index = parseInt(node.textContent || '-1');
        const holderId = this.getHolderId();
        if (!holderId) {
          return false;
        }
        if (!FootnotesTune.notes[holderId]) {
          FootnotesTune.notes[holderId] = [];
        }
        FootnotesTune.notes[holderId].splice(index - 1, 1);

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

  /**
   * Updates notes indices
   */
  private updateIndices(): void {
    const holderId = this.getHolderId();
    if (!holderId) {
      return;
    }
    if (!FootnotesTune.notes[holderId]) {
      FootnotesTune.notes[holderId] = [];
    }
    FootnotesTune.notes[holderId].forEach((note, i) => note.index = i + 1);
  }

  /**
   * Hydrate content passed on render
   *
   * @param content - Tool's content
   */
  private hydrate(content: HTMLElement): void {
    /* content might be not yet populated, so we are using a timeout */
    let popover = this.popover;
    let data = this.data;
    const timeout = 300;
    setTimeout(() => {
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
        FootnotesTune.notes[holderId] = [];
      }

      sups.forEach((sup, i) => {
        if (sup instanceof HTMLElement) {
          if (!data[i]) {
            data[i] = {
              id: sup.dataset.id || '',
              content: '',
              superscript: i + 1,
            };
          }
          const note = new Note(sup as HTMLElement, popover, data[i].id);

          note.index = parseInt(sup.textContent || '0');

          note.content = data[i].content;
          FootnotesTune.notes[holderId].push(note);
        }
      });
    }, timeout);
  }
}

