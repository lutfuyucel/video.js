/**
 * @file player.js
 */
 // Subclasses Component
import Component from './component.js';

import document from 'global/document';
import window from 'global/window';
import * as Events from './utils/events.js';
import * as Dom from './utils/dom.js';
import * as Fn from './utils/fn.js';
import * as Guid from './utils/guid.js';
import * as browser from './utils/browser.js';
import log from './utils/log.js';
import toTitleCase from './utils/to-title-case.js';
import { createTimeRange } from './utils/time-ranges.js';
import { bufferedPercent } from './utils/buffer.js';
import * as stylesheet from './utils/stylesheet.js';
import FullscreenApi from './fullscreen-api.js';
import MediaError from './media-error.js';
import safeParseTuple from 'safe-json-parse/tuple';
import {assign} from './utils/obj';
import mergeOptions from './utils/merge-options.js';
import textTrackConverter from './tracks/text-track-list-converter.js';
import ModalDialog from './modal-dialog';
import Tech from './tech/tech.js';
import AudioTrackList from './tracks/audio-track-list.js';
import VideoTrackList from './tracks/video-track-list.js';

// The following imports are used only to ensure that the corresponding modules
// are always included in the video.js package. Importing the modules will
// execute them and they will register themselves with video.js.
import './tech/loader.js';
import './tech/flash.js';
import './poster-image.js';
import './tracks/text-track-display.js';
import './loading-spinner.js';
import './big-play-button.js';
import './close-button.js';
import './control-bar/control-bar.js';
import './error-display.js';
import './tracks/text-track-settings.js';

// Import Html5 tech, at least for disposing the original video tag.
import './tech/html5.js';

// The following tech events are simply re-triggered
// on the player when they happen
const TECH_EVENTS_RETRIGGER = [
  /**
   * Fired while the user agent is downloading media data.
   *
   * @event Player#progress
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `progress` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechProgress_
   * @fires Player#progress
   * @listens Tech#progress
   */
  'progress',

  /**
   * Fires when the loading of an audio/video is aborted.
   *
   * @event Player#abort
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `abort` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechAbort_
   * @fires Player#abort
   * @listens Tech#abort
   */
  'abort',

  /**
   * Fires when the browser is intentionally not getting media data.
   *
   * @event Player#suspend
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `suspend` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechSuspend_
   * @fires Player#suspend
   * @listens Tech#suspend
   */
  'suspend',

  /**
   * Fires when the current playlist is empty.
   *
   * @event Player#emptied
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `emptied` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechEmptied_
   * @fires Player#emptied
   * @listens Tech#emptied
   */
  'emptied',
  /**
   * Fires when the browser is trying to get media data, but data is not available.
   *
   * @event Player#stalled
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `stalled` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechStalled_
   * @fires Player#stalled
   * @listens Tech#stalled
   */
  'stalled',

  /**
   * Fires when the browser has loaded meta data for the audio/video.
   *
   * @event Player#loadedmetadata
   * @type {EventTarget~Event}
   */
  /**
   * Retrigger the `stalled` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechLoadedmetadata_
   * @fires Player#loadedmetadata
   * @listens Tech#loadedmetadata
   */
  'loadedmetadata',

  /**
   * Fires when the browser has loaded the current frame of the audio/video.
   *
   * @event player#loadeddata
   * @type {event}
   */
  /**
   * Retrigger the `loadeddata` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechLoaddeddata_
   * @fires Player#loadeddata
   * @listens Tech#loadeddata
   */
  'loadeddata',

  /**
   * Fires when the current playback position has changed.
   *
   * @event player#timeupdate
   * @type {event}
   */
  /**
   * Retrigger the `timeupdate` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechTimeUpdate_
   * @fires Player#timeupdate
   * @listens Tech#timeupdate
   */
  'timeupdate',

  /**
   * Fires when the playing speed of the audio/video is changed
   *
   * @event player#ratechange
   * @type {event}
   */
  /**
   * Retrigger the `ratechange` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechRatechange_
   * @fires Player#ratechange
   * @listens Tech#ratechange
   */
  'ratechange',

  /**
   * Fires when the volume has been changed
   *
   * @event player#volumechange
   * @type {event}
   */
  /**
   * Retrigger the `volumechange` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechVolumechange_
   * @fires Player#volumechange
   * @listens Tech#volumechange
   */
  'volumechange',

  /**
   * Fires when the text track has been changed
   *
   * @event player#texttrackchange
   * @type {event}
   */
  /**
   * Retrigger the `texttrackchange` event that was triggered by the {@link Tech}.
   *
   * @private
   * @method Player.prototype.handleTechTexttrackchange_
   * @fires Player#texttrackchange
   * @listens Tech#texttrackchange
   */
  'texttrackchange'
];

/**
 * An instance of the `Player` class is created when any of the Video.js setup methods
 * are used to initialize a video.
 * ```js
 *   var myPlayer = videojs('example_video_1');
 * ```
 *
 * In the following example, the `data-setup` attribute tells the Video.js library to
 * create a player instance when the library is ready.
 * ```html
 *   <video id="example_video_1" data-setup='{}' controls>
 *     <source src="my-source.mp4" type="video/mp4">
 *   </video>
 * ```
 *
 * After an instance has been created it can be accessed globally in two ways:
 * 1. By calling `videojs('example_video_1');`
 * 2. By using it directly via  `videojs.players.example_video_1;`
 *
 * @extends Component
 */
class Player extends Component {

  /**
   * Create an instance of this class.
   *
   * @param {Element} tag
   *        The original video DOM element used for configuring options.
   *
   * @param {Object} [options]
   *        Object of option names and values.
   *
   * @param {Component~ReadyCallback} [ready]
   *        Ready callback function.
   */
  constructor(tag, options, ready) {
    // Make sure tag ID exists
    tag.id = tag.id || `vjs_video_${Guid.newGUID()}`;

    // Set Options
    // The options argument overrides options set in the video tag
    // which overrides globally set options.
    // This latter part coincides with the load order
    // (tag must exist before Player)
    options = assign(Player.getTagSettings(tag), options);

    // Delay the initialization of children because we need to set up
    // player properties first, and can't use `this` before `super()`
    options.initChildren = false;

    // Same with creating the element
    options.createEl = false;

    // we don't want the player to report touch activity on itself
    // see enableTouchActivity in Component
    options.reportTouchActivity = false;

    // If language is not set, get the closest lang attribute
    if (!options.language) {
      if (typeof tag.closest === 'function') {
        const closest = tag.closest('[lang]');

        if (closest) {
          options.language = closest.getAttribute('lang');
        }
      } else {
        let element = tag;

        while (element && element.nodeType === 1) {
          if (Dom.getElAttributes(element).hasOwnProperty('lang')) {
            options.language = element.getAttribute('lang');
            break;
          }
          element = element.parentNode;
        }
      }
    }

    // Run base component initializing with new options
    super(null, options, ready);

    // if the global option object was accidentally blown away by
    // someone, bail early with an informative error
    if (!this.options_ ||
        !this.options_.techOrder ||
        !this.options_.techOrder.length) {
      throw new Error('No techOrder specified. Did you overwrite ' +
                      'videojs.options instead of just changing the ' +
                      'properties you want to override?');
    }

    // Store the original tag used to set options
    this.tag = tag;

    // Store the tag attributes used to restore html5 element
    this.tagAttributes = tag && Dom.getElAttributes(tag);

    // Update current language
    this.language(this.options_.language);

    // Update Supported Languages
    if (options.languages) {
      // Normalise player option languages to lowercase
      const languagesToLower = {};

      Object.getOwnPropertyNames(options.languages).forEach(function(name) {
        languagesToLower[name.toLowerCase()] = options.languages[name];
      });
      this.languages_ = languagesToLower;
    } else {
      this.languages_ = Player.prototype.options_.languages;
    }

    // Cache for video property values.
    this.cache_ = {};

    // Set poster
    this.poster_ = options.poster || '';

    // Set controls
    this.controls_ = !!options.controls;

    // Original tag settings stored in options
    // now remove immediately so native controls don't flash.
    // May be turned back on by HTML5 tech if nativeControlsForTouch is true
    tag.controls = false;

    /*
     * Store the internal state of scrubbing
     *
     * @private
     * @return {Boolean} True if the user is scrubbing
     */
    this.scrubbing_ = false;

    this.el_ = this.createEl();

    // We also want to pass the original player options to each component and plugin
    // as well so they don't need to reach back into the player for options later.
    // We also need to do another copy of this.options_ so we don't end up with
    // an infinite loop.
    const playerOptionsCopy = mergeOptions(this.options_);

    // Load plugins
    if (options.plugins) {
      const plugins = options.plugins;

      Object.getOwnPropertyNames(plugins).forEach(function(name) {
        if (typeof this[name] === 'function') {
          this[name](plugins[name]);
        } else {
          log.error('Unable to find plugin:', name);
        }
      }, this);
    }

    this.options_.playerOptions = playerOptionsCopy;

    this.initChildren();

    // Set isAudio based on whether or not an audio tag was used
    this.isAudio(tag.nodeName.toLowerCase() === 'audio');

    // Update controls className. Can't do this when the controls are initially
    // set because the element doesn't exist yet.
    if (this.controls()) {
      this.addClass('vjs-controls-enabled');
    } else {
      this.addClass('vjs-controls-disabled');
    }

    // Set ARIA label and region role depending on player type
    this.el_.setAttribute('role', 'region');
    if (this.isAudio()) {
      this.el_.setAttribute('aria-label', 'audio player');
    } else {
      this.el_.setAttribute('aria-label', 'video player');
    }

    if (this.isAudio()) {
      this.addClass('vjs-audio');
    }

    if (this.flexNotSupported_()) {
      this.addClass('vjs-no-flex');
    }

    // TODO: Make this smarter. Toggle user state between touching/mousing
    // using events, since devices can have both touch and mouse events.
    // if (browser.TOUCH_ENABLED) {
    //   this.addClass('vjs-touch-enabled');
    // }

    // iOS Safari has broken hover handling
    if (!browser.IS_IOS) {
      this.addClass('vjs-workinghover');
    }

    // Make player easily findable by ID
    Player.players[this.id_] = this;

    // When the player is first initialized, trigger activity so components
    // like the control bar show themselves if needed
    this.userActive(true);
    this.reportUserActivity();
    this.listenForUserActivity_();

    this.on('fullscreenchange', this.handleFullscreenChange_);
    this.on('stageclick', this.handleStageClick_);
  }

  /**
   * Destroys the video player and does any necessary cleanup.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     myPlayer.dispose();
   *   });
   * ```
   * This is especially helpful if you are dynamically adding and removing videos
   * to/from the DOM.
   *
   * @fires Player#dispose
   */
  dispose() {
    /**
     * Called when the player is being disposed of.
     *
     * @event Player#dispose
     * @type {EventTarget~Event}
     */
    this.trigger('dispose');
    // prevent dispose from being called twice
    this.off('dispose');

    if (this.styleEl_ && this.styleEl_.parentNode) {
      this.styleEl_.parentNode.removeChild(this.styleEl_);
    }

    // Kill reference to this player
    Player.players[this.id_] = null;

    if (this.tag && this.tag.player) {
      this.tag.player = null;
    }

    if (this.el_ && this.el_.player) {
      this.el_.player = null;
    }

    if (this.tech_) {
      this.tech_.dispose();
    }

    super.dispose();
  }

  /**
   * Create the `Player`'s DOM element.
   *
   * @return {Element}
   *         The DOM element that gets created.
   */
  createEl() {
    const el = this.el_ = super.createEl('div');
    const tag = this.tag;

    // Remove width/height attrs from tag so CSS can make it 100% width/height
    tag.removeAttribute('width');
    tag.removeAttribute('height');

    // Copy over all the attributes from the tag, including ID and class
    // ID will now reference player box, not the video tag
    const attrs = Dom.getElAttributes(tag);

    Object.getOwnPropertyNames(attrs).forEach(function(attr) {
      // workaround so we don't totally break IE7
      // http://stackoverflow.com/questions/3653444/css-styles-not-applied-on-dynamic-elements-in-internet-explorer-7
      if (attr === 'class') {
        el.className = attrs[attr];
      } else {
        el.setAttribute(attr, attrs[attr]);
      }
    });

    // Update tag id/class for use as HTML5 playback tech
    // Might think we should do this after embedding in container so .vjs-tech class
    // doesn't flash 100% width/height, but class only applies with .video-js parent
    tag.playerId = tag.id;
    tag.id += '_html5_api';
    tag.className = 'vjs-tech';

    // Make player findable on elements
    tag.player = el.player = this;
    // Default state of video is paused
    this.addClass('vjs-paused');

    // Add a style element in the player that we'll use to set the width/height
    // of the player in a way that's still overrideable by CSS, just like the
    // video element
    if (window.VIDEOJS_NO_DYNAMIC_STYLE !== true) {
      this.styleEl_ = stylesheet.createStyleElement('vjs-styles-dimensions');
      const defaultsStyleEl = Dom.$('.vjs-styles-defaults');
      const head = Dom.$('head');

      head.insertBefore(this.styleEl_, defaultsStyleEl ? defaultsStyleEl.nextSibling : head.firstChild);
    }

    // Pass in the width/height/aspectRatio options which will update the style el
    this.width(this.options_.width);
    this.height(this.options_.height);
    this.fluid(this.options_.fluid);
    this.aspectRatio(this.options_.aspectRatio);

    // Hide any links within the video/audio tag, because IE doesn't hide them completely.
    const links = tag.getElementsByTagName('a');

    for (let i = 0; i < links.length; i++) {
      const linkEl = links.item(i);

      Dom.addElClass(linkEl, 'vjs-hidden');
      linkEl.setAttribute('hidden', 'hidden');
    }

    // insertElFirst seems to cause the networkState to flicker from 3 to 2, so
    // keep track of the original for later so we can know if the source originally failed
    tag.initNetworkState_ = tag.networkState;

    // Wrap video tag in div (el/box) container
    if (tag.parentNode) {
      tag.parentNode.insertBefore(el, tag);
    }

    // insert the tag as the first child of the player element
    // then manually add it to the children array so that this.addChild
    // will work properly for other components
    //
    // Breaks iPhone, fixed in HTML5 setup.
    Dom.insertElFirst(tag, el);
    this.children_.unshift(tag);

    this.el_ = el;

    return el;
  }

  /**
   * A getter/setter for the `Player`'s width.
   *
   * @param {number} [value]
   *        The value to set the `Player's width to.
   *
   * @return {number}
   *         The current width of the `Player`.
   */
  width(value) {
    return this.dimension('width', value);
  }

  /**
   * A getter/setter for the `Player`'s height.
   *
   * @param {number} [value]
   *        The value to set the `Player's heigth to.
   *
   * @return {number}
   *         The current heigth of the `Player`.
   */
  height(value) {
    return this.dimension('height', value);
  }

  /**
   * A getter/setter for the `Player`'s width & height.
   *
   * @param {string} dimension
   *        This string can be:
   *        - 'width'
   *        - 'height'
   *
   * @param {number} [value]
   *        Value for dimension specified in the first argument.
   *
   * @return {Player|number}
   *         - Returns itself when setting; method can be chained.
   *         - The dimension arguments value when getting (width/height).
   */
  dimension(dimension, value) {
    const privDimension = dimension + '_';

    if (value === undefined) {
      return this[privDimension] || 0;
    }

    if (value === '') {
      // If an empty string is given, reset the dimension to be automatic
      this[privDimension] = undefined;
    } else {
      const parsedVal = parseFloat(value);

      if (isNaN(parsedVal)) {
        log.error(`Improper value "${value}" supplied for for ${dimension}`);
        return this;
      }

      this[privDimension] = parsedVal;
    }

    this.updateStyleEl_();
    return this;
  }

  /**
   * A getter/setter/toggler for the vjs-fluid `className` on the `Player`.
   *
   * @param {boolean} [bool]
   *        - A value of true adds the class.
   *        - A value of false removes the class.
   *        - No value will toggle the fluid class.
   *
   * @return {boolean|undefined}
   *         - The value of fluid when getting.
   *         - `undefined` when setting.
   */
  fluid(bool) {
    if (bool === undefined) {
      return !!this.fluid_;
    }

    this.fluid_ = !!bool;

    if (bool) {
      this.addClass('vjs-fluid');
    } else {
      this.removeClass('vjs-fluid');
    }

    this.updateStyleEl_();
  }

  /**
   * Get/Set the aspect ratio
   *
   * @param {string} [ratio]
   *        Aspect ratio for player
   *
   * @return {string|undefined}
   *         returns the current aspect ratio when getting
   */

  /**
   * A getter/setter for the `Player`'s aspect ratio.
   *
   * @param {string} [ratio]
   *        The value to set the `Player's aspect ratio to.
   *
   * @return {string|undefined}
   *         - The current aspect ratio of the `Player` when getting.
   *         - undefined when setting
   */
  aspectRatio(ratio) {
    if (ratio === undefined) {
      return this.aspectRatio_;
    }

    // Check for width:height format
    if (!(/^\d+\:\d+$/).test(ratio)) {
      throw new Error('Improper value supplied for aspect ratio. The format should be width:height, for example 16:9.');
    }
    this.aspectRatio_ = ratio;

    // We're assuming if you set an aspect ratio you want fluid mode,
    // because in fixed mode you could calculate width and height yourself.
    this.fluid(true);

    this.updateStyleEl_();
  }

  /**
   * Update styles of the `Player` element (height, width and aspect ratio).
   *
   * @private
   * @listens Tech#loadedmetadata
   */
  updateStyleEl_() {
    if (window.VIDEOJS_NO_DYNAMIC_STYLE === true) {
      const width = typeof this.width_ === 'number' ? this.width_ : this.options_.width;
      const height = typeof this.height_ === 'number' ? this.height_ : this.options_.height;
      const techEl = this.tech_ && this.tech_.el();

      if (techEl) {
        if (width >= 0) {
          techEl.width = width;
        }
        if (height >= 0) {
          techEl.height = height;
        }
      }

      return;
    }

    let width;
    let height;
    let aspectRatio;
    let idClass;

    // The aspect ratio is either used directly or to calculate width and height.
    if (this.aspectRatio_ !== undefined && this.aspectRatio_ !== 'auto') {
      // Use any aspectRatio that's been specifically set
      aspectRatio = this.aspectRatio_;
    } else if (this.videoWidth() > 0) {
      // Otherwise try to get the aspect ratio from the video metadata
      aspectRatio = this.videoWidth() + ':' + this.videoHeight();
    } else {
      // Or use a default. The video element's is 2:1, but 16:9 is more common.
      aspectRatio = '16:9';
    }

    // Get the ratio as a decimal we can use to calculate dimensions
    const ratioParts = aspectRatio.split(':');
    const ratioMultiplier = ratioParts[1] / ratioParts[0];

    if (this.width_ !== undefined) {
      // Use any width that's been specifically set
      width = this.width_;
    } else if (this.height_ !== undefined) {
      // Or calulate the width from the aspect ratio if a height has been set
      width = this.height_ / ratioMultiplier;
    } else {
      // Or use the video's metadata, or use the video el's default of 300
      width = this.videoWidth() || 300;
    }

    if (this.height_ !== undefined) {
      // Use any height that's been specifically set
      height = this.height_;
    } else {
      // Otherwise calculate the height from the ratio and the width
      height = width * ratioMultiplier;
    }

    // Ensure the CSS class is valid by starting with an alpha character
    if ((/^[^a-zA-Z]/).test(this.id())) {
      idClass = 'dimensions-' + this.id();
    } else {
      idClass = this.id() + '-dimensions';
    }

    // Ensure the right class is still on the player for the style element
    this.addClass(idClass);

    stylesheet.setTextContent(this.styleEl_, `
      .${idClass} {
        width: ${width}px;
        height: ${height}px;
      }

      .${idClass}.vjs-fluid {
        padding-top: ${ratioMultiplier * 100}%;
      }
    `);
  }

  /**
   * Load/Create an instance of playback {@link Tech} including element
   * and API methods. Then append the `Tech` element in `Player` as a child.
   *
   * @param {string} techName
   *        name of the playback technology
   *
   * @param {string} source
   *        video source
   *
   * @private
   */
  loadTech_(techName, source) {

    // Pause and remove current playback technology
    if (this.tech_) {
      this.unloadTech_();
    }

    // get rid of the HTML5 video tag as soon as we are using another tech
    if (techName !== 'Html5' && this.tag) {
      Tech.getTech('Html5').disposeMediaElement(this.tag);
      this.tag.player = null;
      this.tag = null;
    }

    this.techName_ = techName;

    // Turn off API access because we're loading a new tech that might load asynchronously
    this.isReady_ = false;

    // Grab tech-specific options from player options and add source and parent element to use.
    const techOptions = assign({
      source,
      'nativeControlsForTouch': this.options_.nativeControlsForTouch,
      'playerId': this.id(),
      'techId': `${this.id()}_${techName}_api`,
      'videoTracks': this.videoTracks_,
      'textTracks': this.textTracks_,
      'audioTracks': this.audioTracks_,
      'autoplay': this.options_.autoplay,
      'preload': this.options_.preload,
      'loop': this.options_.loop,
      'muted': this.options_.muted,
      'poster': this.poster(),
      'language': this.language(),
      'vtt.js': this.options_['vtt.js']
    }, this.options_[techName.toLowerCase()]);

    if (this.tag) {
      techOptions.tag = this.tag;
    }

    if (source) {
      this.currentType_ = source.type;

      if (source.src === this.cache_.src && this.cache_.currentTime > 0) {
        techOptions.startTime = this.cache_.currentTime;
      }

      this.cache_.sources = null;
      this.cache_.source = source;
      this.cache_.src = source.src;
    }

    // Initialize tech instance
    let TechComponent = Tech.getTech(techName);

    // Support old behavior of techs being registered as components.
    // Remove once that deprecated behavior is removed.
    if (!TechComponent) {
      TechComponent = Component.getComponent(techName);
    }
    this.tech_ = new TechComponent(techOptions);

    // player.triggerReady is always async, so don't need this to be async
    this.tech_.ready(Fn.bind(this, this.handleTechReady_), true);

    textTrackConverter.jsonToTextTracks(this.textTracksJson_ || [], this.tech_);

    // Listen to all HTML5-defined events and trigger them on the player
    TECH_EVENTS_RETRIGGER.forEach((event) => {
      this.on(this.tech_, event, this[`handleTech${toTitleCase(event)}_`]);
    });
    this.on(this.tech_, 'loadstart', this.handleTechLoadStart_);
    this.on(this.tech_, 'waiting', this.handleTechWaiting_);
    this.on(this.tech_, 'canplay', this.handleTechCanPlay_);
    this.on(this.tech_, 'canplaythrough', this.handleTechCanPlayThrough_);
    this.on(this.tech_, 'playing', this.handleTechPlaying_);
    this.on(this.tech_, 'ended', this.handleTechEnded_);
    this.on(this.tech_, 'seeking', this.handleTechSeeking_);
    this.on(this.tech_, 'seeked', this.handleTechSeeked_);
    this.on(this.tech_, 'play', this.handleTechPlay_);
    this.on(this.tech_, 'firstplay', this.handleTechFirstPlay_);
    this.on(this.tech_, 'pause', this.handleTechPause_);
    this.on(this.tech_, 'durationchange', this.handleTechDurationChange_);
    this.on(this.tech_, 'fullscreenchange', this.handleTechFullscreenChange_);
    this.on(this.tech_, 'error', this.handleTechError_);
    this.on(this.tech_, 'loadedmetadata', this.updateStyleEl_);
    this.on(this.tech_, 'posterchange', this.handleTechPosterChange_);
    this.on(this.tech_, 'textdata', this.handleTechTextData_);

    this.usingNativeControls(this.techGet_('controls'));

    if (this.controls() && !this.usingNativeControls()) {
      this.addTechControlsListeners_();
    }

    // Add the tech element in the DOM if it was not already there
    // Make sure to not insert the original video element if using Html5
    if (this.tech_.el().parentNode !== this.el() && (techName !== 'Html5' || !this.tag)) {
      Dom.insertElFirst(this.tech_.el(), this.el());
    }

    // Get rid of the original video tag reference after the first tech is loaded
    if (this.tag) {
      this.tag.player = null;
      this.tag = null;
    }
  }

  /**
   * Unload and dispose of the current playback {@link Tech}.
   *
   * @private
   */
  unloadTech_() {
    // Save the current text tracks so that we can reuse the same text tracks with the next tech
    this.videoTracks_ = this.videoTracks();
    this.textTracks_ = this.textTracks();
    this.audioTracks_ = this.audioTracks();
    this.textTracksJson_ = textTrackConverter.textTracksToJson(this.tech_);

    this.isReady_ = false;

    this.tech_.dispose();

    this.tech_ = false;
  }

  /**
   * Return a reference to the current {@link Tech}, but only if given an object with the
   * `IWillNotUseThisInPlugins` property having a true value. This is try and prevent misuse
   * of techs by plugins.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *      // function call throws an error if we
   *       // dont add {IWillNotUseThisInPlugins: true}
   *      var tech = myPlayer.tech({IWillNotUseThisInPlugins: true});
   *   });
   * ```
   *
   * @param {Object} safety
   *        An object that must contain `{IWillNotUseThisInPlugins: true}`
   *
   * @param {boolean} safety.IWillNotUseThisInPlugins
   *        Must be set to true or else this function will throw an error.
   *
   * @return {Tech}
   *         The Tech
   */
  tech(safety) {
    if (safety && safety.IWillNotUseThisInPlugins) {
      return this.tech_;
    }
    const errorText = `
      Please make sure that you are not using this inside of a plugin.
      To disable this alert and error, please pass in an object with
      \`IWillNotUseThisInPlugins\` to the \`tech\` method. See
      https://github.com/videojs/video.js/issues/2617 for more info.
    `;

    window.alert(errorText);
    throw new Error(errorText);
  }

  /**
   * Set up click and touch listeners for the playback element
   *
   * - On desktops: a click on the video itself will toggle playback
   * - On mobile devices: a click on the video toggles controls
   *   which is done by toggling the user state between active and
   *   inactive
   * - A tap can signal that a user has become active or has become inactive
   *   e.g. a quick tap on an iPhone movie should reveal the controls. Another
   *   quick tap should hide them again (signaling the user is in an inactive
   *   viewing state)
   * - In addition to this, we still want the user to be considered inactive after
   *   a few seconds of inactivity.
   *
   * > Note: the only part of iOS interaction we can't mimic with this setup
   * is a touch and hold on the video element counting as activity in order to
   * keep the controls showing, but that shouldn't be an issue. A touch and hold
   * on any controls will still keep the user active
   *
   * @private
   */
  addTechControlsListeners_() {
    // Make sure to remove all the previous listeners in case we are called multiple times.
    this.removeTechControlsListeners_();

    // Some browsers (Chrome & IE) don't trigger a click on a flash swf, but do
    // trigger mousedown/up.
    // http://stackoverflow.com/questions/1444562/javascript-onclick-event-over-flash-object
    // Any touch events are set to block the mousedown event from happening
    this.on(this.tech_, 'mousedown', this.handleTechClick_);

    // If the controls were hidden we don't want that to change without a tap event
    // so we'll check if the controls were already showing before reporting user
    // activity
    this.on(this.tech_, 'touchstart', this.handleTechTouchStart_);
    this.on(this.tech_, 'touchmove', this.handleTechTouchMove_);
    this.on(this.tech_, 'touchend', this.handleTechTouchEnd_);

    // The tap listener needs to come after the touchend listener because the tap
    // listener cancels out any reportedUserActivity when setting userActive(false)
    this.on(this.tech_, 'tap', this.handleTechTap_);
  }

  /**
   * Remove the listeners used for click and tap controls. This is needed for
   * toggling to controls disabled, where a tap/touch should do nothing.
   *
   * @private
   */
  removeTechControlsListeners_() {
    // We don't want to just use `this.off()` because there might be other needed
    // listeners added by techs that extend this.
    this.off(this.tech_, 'tap', this.handleTechTap_);
    this.off(this.tech_, 'touchstart', this.handleTechTouchStart_);
    this.off(this.tech_, 'touchmove', this.handleTechTouchMove_);
    this.off(this.tech_, 'touchend', this.handleTechTouchEnd_);
    this.off(this.tech_, 'mousedown', this.handleTechClick_);
  }

  /**
   * Player waits for the tech to be ready
   *
   * @private
   */
  handleTechReady_() {
    this.triggerReady();

    // Keep the same volume as before
    if (this.cache_.volume) {
      this.techCall_('setVolume', this.cache_.volume);
    }

    // Look if the tech found a higher resolution poster while loading
    this.handleTechPosterChange_();

    // Update the duration if available
    this.handleTechDurationChange_();

    // Chrome and Safari both have issues with autoplay.
    // In Safari (5.1.1), when we move the video element into the container div, autoplay doesn't work.
    // In Chrome (15), if you have autoplay + a poster + no controls, the video gets hidden (but audio plays)
    // This fixes both issues. Need to wait for API, so it updates displays correctly
    if ((this.src() || this.currentSrc()) && this.tag && this.options_.autoplay && this.paused()) {
      try {
        // Chrome Fix. Fixed in Chrome v16.
        delete this.tag.poster;
      } catch (e) {
        log('deleting tag.poster throws in some browsers', e);
      }
      this.play();
    }
  }

  /**
   * Retrigger the `loadstart` event that was triggered by the {@link Tech}. This
   * function will also trigger {@link Player#firstplay} if it is the first loadstart
   * for a video.
   *
   * @fires Player#loadstart
   * @fires Player#firstplay
   * @listens Tech#loadstart
   * @private
   */
  handleTechLoadStart_() {
    // TODO: Update to use `emptied` event instead. See #1277.

    this.removeClass('vjs-ended');

    // reset the error state
    this.error(null);

    // If it's already playing we want to trigger a firstplay event now.
    // The firstplay event relies on both the play and loadstart events
    // which can happen in any order for a new source
    if (!this.paused()) {
      /**
       * Fired when the user agent begins looking for media data
       *
       * @event Player#loadstart
       * @type {EventTarget~Event}
       */
      this.trigger('loadstart');
      this.trigger('firstplay');
    } else {
      // reset the hasStarted state
      this.hasStarted(false);
      this.trigger('loadstart');
    }
  }

  /**
   * Add/remove the vjs-has-started class
   *
   * @fires Player#firstplay
   *
   * @param {boolean} hasStarted
   *        - true: adds the class
   *        - false: remove the class
   *
   * @return {boolean}
   *         the boolean value of hasStarted
   */
  hasStarted(hasStarted) {
    if (hasStarted !== undefined) {
      // only update if this is a new value
      if (this.hasStarted_ !== hasStarted) {
        this.hasStarted_ = hasStarted;
        if (hasStarted) {
          this.addClass('vjs-has-started');
          // trigger the firstplay event if this newly has played
          this.trigger('firstplay');
        } else {
          this.removeClass('vjs-has-started');
        }
      }
      return this;
    }
    return !!this.hasStarted_;
  }

  /**
   * Fired whenever the media begins or resumes playback
   *
   * @see [Spec]{@link https://html.spec.whatwg.org/multipage/embedded-content.html#dom-media-play}
   * @fires Player#play
   * @listens Tech#play
   * @private
   */
  handleTechPlay_() {
    this.removeClass('vjs-ended');
    this.removeClass('vjs-paused');
    this.addClass('vjs-playing');

    // hide the poster when the user hits play
    this.hasStarted(true);
    /**
     * Triggered whenever an {@link Tech#play} event happens. Indicates that
     * playback has started or resumed.
     *
     * @event Player#play
     * @type {EventTarget~Event}
     */
    this.trigger('play');
  }

  /**
   * Retrigger the `waiting` event that was triggered by the {@link Tech}.
   *
   * @fires Player#waiting
   * @listens Tech#waiting
   * @private
   */
  handleTechWaiting_() {
    this.addClass('vjs-waiting');
    /**
     * A readyState change on the DOM element has caused playback to stop.
     *
     * @event Player#waiting
     * @type {EventTarget~Event}
     */
    this.trigger('waiting');
    this.one('timeupdate', () => this.removeClass('vjs-waiting'));
  }

  /**
   * Retrigger the `canplay` event that was triggered by the {@link Tech}.
   * > Note: This is not consistent between browsers. See #1351
   *
   * @fires Player#canplay
   * @listens Tech#canplay
   * @private
   */
  handleTechCanPlay_() {
    this.removeClass('vjs-waiting');
    /**
     * The media has a readyState of HAVE_FUTURE_DATA or greater.
     *
     * @event Player#canplay
     * @type {EventTarget~Event}
     */
    this.trigger('canplay');
  }

  /**
   * Retrigger the `canplaythrough` event that was triggered by the {@link Tech}.
   *
   * @fires Player#canplaythrough
   * @listens Tech#canplaythrough
   * @private
   */
  handleTechCanPlayThrough_() {
    this.removeClass('vjs-waiting');
    /**
     * The media has a readyState of HAVE_ENOUGH_DATA or greater. This means that the
     * entire media file can be played without buffering.
     *
     * @event Player#canplaythrough
     * @type {EventTarget~Event}
     */
    this.trigger('canplaythrough');
  }

  /**
   * Retrigger the `playing` event that was triggered by the {@link Tech}.
   *
   * @fires Player#playing
   * @listens Tech#playing
   * @private
   */
  handleTechPlaying_() {
    this.removeClass('vjs-waiting');
    /**
     * The media is no longer blocked from playback, and has started playing.
     *
     * @event Player#playing
     * @type {EventTarget~Event}
     */
    this.trigger('playing');
  }

  /**
   * Retrigger the `seeking` event that was triggered by the {@link Tech}.
   *
   * @fires Player#seeking
   * @listens Tech#seeking
   * @private
   */
  handleTechSeeking_() {
    this.addClass('vjs-seeking');
    /**
     * Fired whenever the player is jumping to a new time
     *
     * @event Player#seeking
     * @type {EventTarget~Event}
     */
    this.trigger('seeking');
  }

  /**
   * Retrigger the `seeked` event that was triggered by the {@link Tech}.
   *
   * @fires Player#seeked
   * @listens Tech#seeked
   * @private
   */
  handleTechSeeked_() {
    this.removeClass('vjs-seeking');
    /**
     * Fired when the player has finished jumping to a new time
     *
     * @event Player#seeked
     * @type {EventTarget~Event}
     */
    this.trigger('seeked');
  }

  /**
   * Retrigger the `firstplay` event that was triggered by the {@link Tech}.
   *
   * @fires Player#firstplay
   * @listens Tech#firstplay
   * @private
   */
  handleTechFirstPlay_() {
    // If the first starttime attribute is specified
    // then we will start at the given offset in seconds
    if (this.options_.starttime) {
      this.currentTime(this.options_.starttime);
    }

    this.addClass('vjs-has-started');
    /**
     * Fired the first time a video is played. Not part of the HLS spec, and this is
     * probably not the best implementation yet, so use sparingly. If you don't have a
     * reason to prevent playback, use `myPlayer.one('play');` instead.
     *
     * @event Player#firstplay
     * @type {EventTarget~Event}
     */
    this.trigger('firstplay');
  }

  /**
   * Retrigger the `pause` event that was triggered by the {@link Tech}.
   *
   * @fires Player#pause
   * @listens Tech#pause
   * @private
   */
  handleTechPause_() {
    this.removeClass('vjs-playing');
    this.addClass('vjs-paused');
    /**
     * Fired whenever the media has been paused
     *
     * @event Player#pause
     * @type {EventTarget~Event}
     */
    this.trigger('pause');
  }

  /**
   * Retrigger the `ended` event that was triggered by the {@link Tech}.
   *
   * @fires Player#ended
   * @listens Tech#ended
   * @private
   */
  handleTechEnded_() {
    this.addClass('vjs-ended');
    if (this.options_.loop) {
      this.currentTime(0);
      this.play();
    } else if (!this.paused()) {
      this.pause();
    }

    /**
     * Fired when the end of the media resource is reached (currentTime == duration)
     *
     * @event Player#ended
     * @type {EventTarget~Event}
     */
    this.trigger('ended');
  }

  /**
   * Fired when the duration of the media resource is first known or changed
   *
   * @listens Tech#durationchange
   * @private
   */
  handleTechDurationChange_() {
    this.duration(this.techGet_('duration'));
  }

  /**
   * Handle a click on the media element to play/pause
   *
   * @param {EventTarget~Event} event
   *        the event that caused this function to trigger
   *
   * @listens Tech#mousedown
   * @private
   */
  handleTechClick_(event) {
    // We're using mousedown to detect clicks thanks to Flash, but mousedown
    // will also be triggered with right-clicks, so we need to prevent that
    if (event.button !== 0) {
      return;
    }

    // When controls are disabled a click should not toggle playback because
    // the click is considered a control
    if (this.controls()) {
      if (this.paused()) {
        this.play();
      } else {
        this.pause();
      }
    }
  }

  /**
   * Handle a tap on the media element. It will toggle the user
   * activity state, which hides and shows the controls.
   *
   * @listens Tech#tap
   * @private
   */
  handleTechTap_() {
    this.userActive(!this.userActive());
  }

  /**
   * Handle touch to start
   *
   * @listens Tech#touchstart
   * @private
   */
  handleTechTouchStart_() {
    this.userWasActive = this.userActive();
  }

  /**
   * Handle touch to move
   *
   * @listens Tech#touchmove
   * @private
   */
  handleTechTouchMove_() {
    if (this.userWasActive) {
      this.reportUserActivity();
    }
  }

  /**
   * Handle touch to end
   *
   * @param {EventTarget~Event} event
   *        the touchend event that triggered
   *        this function
   *
   * @listens Tech#touchend
   * @private
   */
  handleTechTouchEnd_(event) {
    // Stop the mouse events from also happening
    event.preventDefault();
  }

  /**
   * Fired when the player switches in or out of fullscreen mode
   *
   * @private
   * @listens Player#fullscreenchange
   */
  handleFullscreenChange_() {
    if (this.isFullscreen()) {
      this.addClass('vjs-fullscreen');
    } else {
      this.removeClass('vjs-fullscreen');
    }
  }

  /**
   * native click events on the SWF aren't triggered on IE11, Win8.1RT
   * use stageclick events triggered from inside the SWF instead
   *
   * @private
   * @listens stageclick
   */
  handleStageClick_() {
    this.reportUserActivity();
  }

  /**
   * Handle Tech Fullscreen Change
   *
   * @param {EventTarget~Event} event
   *        the fullscreenchange event that triggered this function
   *
   * @param {Object} data
   *        the data that was sent with the event
   *
   * @private
   * @listens Tech#fullscreenchange
   * @fires Player#fullscreenchange
   */
  handleTechFullscreenChange_(event, data) {
    if (data) {
      this.isFullscreen(data.isFullscreen);
    }
    /**
     * Fired when going in and out of fullscreen.
     *
     * @event Player#fullscreenchange
     * @type {EventTarget~Event}
     */
    this.trigger('fullscreenchange');
  }

  /**
   * Fires when an error occurred during the loading of an audio/video.
   *
   * @private
   * @listens Tech#error
   */
  handleTechError_() {
    const error = this.tech_.error();

    this.error(error);
  }

  /**
   * Retrigger the `textdata` event that was triggered by the {@link Tech}.
   *
   * @fires Player#textdata
   * @listens Tech#textdata
   * @private
   */
  handleTechTextData_() {
    let data = null;

    if (arguments.length > 1) {
      data = arguments[1];
    }

    /**
     * Fires when we get a textdata event from tech
     *
     * @event Player#textdata
     * @type {EventTarget~Event}
     */
    this.trigger('textdata', data);
  }

  /**
   * Get object for cached values.
   *
   * @return {Object}
   *         get the current object cache
   */
  getCache() {
    return this.cache_;
  }

  /**
   * Pass values to the playback tech
   *
   * @param {string} [method]
   *        the method to call
   *
   * @param {Object} arg
   *        the argument to pass
   *
   * @private
   */
  techCall_(method, arg) {
    // If it's not ready yet, call method when it is
    if (this.tech_ && !this.tech_.isReady_) {
      this.tech_.ready(function() {
        this[method](arg);
      }, true);

    // Otherwise call method now
    } else {
      try {
        if (this.tech_) {
          this.tech_[method](arg);
        }
      } catch (e) {
        log(e);
        throw e;
      }
    }
  }

  /**
   * Get calls can't wait for the tech, and sometimes don't need to.
   *
   * @param {string} method
   *        Tech method
   *
   * @return {Function|undefined}
   *         the method or undefined
   *
   * @private
   */
  techGet_(method) {
    if (this.tech_ && this.tech_.isReady_) {

      // Flash likes to die and reload when you hide or reposition it.
      // In these cases the object methods go away and we get errors.
      // When that happens we'll catch the errors and inform tech that it's not ready any more.
      try {
        return this.tech_[method]();
      } catch (e) {
        // When building additional tech libs, an expected method may not be defined yet
        if (this.tech_[method] === undefined) {
          log(`Video.js: ${method} method not defined for ${this.techName_} playback technology.`, e);

        // When a method isn't available on the object it throws a TypeError
        } else if (e.name === 'TypeError') {
          log(`Video.js: ${method} unavailable on ${this.techName_} playback technology element.`, e);
          this.tech_.isReady_ = false;
        } else {
          log(e);
        }
        throw e;
      }
    }

    return;
  }

  /**
   * start media playback
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     myPlayer.play();
   *   });
   * ```
   *
   * @return {Player}
   *         A reference to the player object this function was called on
   */
  play() {
    // Only calls the tech's play if we already have a src loaded
    if (this.src() || this.currentSrc()) {
      this.techCall_('play');
    } else {
      this.tech_.one('loadstart', function() {
        this.play();
      });
    }

    return this;
  }

  /**
   * Pause the video playback
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     myPlayer.play();
   *     myPlayer.pause();
   *   });
   * ```
   *
   * @return {Player}
   *         A reference to the player object this function was called on
   */
  pause() {
    this.techCall_('pause');
    return this;
  }

  /**
   * Check if the player is paused or has yet to play
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *
   *   myPlayer.ready(function() {
   *     // true
   *     console.log(myPlayer.paused());
   *     // false
   *     console.log(!myPlayer.paused());
   *
   *     myPlayer.play();
   *     // false
   *     console.log(myPlayer.paused());
   *     // true
   *     console.log(!myPlayer.paused());
   *
   *     myPlayer.pause();
   *     // true
   *     console.log(myPlayer.paused());
   *     // false
   *     console.log(!myPlayer.paused());
   *   });
   *
   * ```
   *
   * @return {boolean}
   *         - false: if the media is currently playing
   *         - true: if media is not currently playing
   */
  paused() {
    // The initial state of paused should be true (in Safari it's actually false)
    return (this.techGet_('paused') === false) ? false : true;
  }

  /**
   * Returns whether or not the user is "scrubbing". Scrubbing is
   * when the user has clicked the progress bar handle and is
   * dragging it along the progress bar.
   *
   * @param {boolean} [isScrubbing]
   *        wether the user is or is not scrubbing
   *
   * @return {boolean|Player}
   *         A instance of the player that called this function when setting,
   *         and the value of scrubbing when getting
   */
  scrubbing(isScrubbing) {
    if (isScrubbing !== undefined) {
      this.scrubbing_ = !!isScrubbing;

      if (isScrubbing) {
        this.addClass('vjs-scrubbing');
      } else {
        this.removeClass('vjs-scrubbing');
      }

      return this;
    }

    return this.scrubbing_;
  }

  /**
   * Get or set the current time (in seconds)
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     // set current time to 2 minutes into the video
   *     myPlayer.currentTime(120);
   *
   *     // get the current time, should be 120 seconds
   *     var whereYouAt = myPlayer.currentTime();
   *   });
   * ```
   *
   * @param {number|string} [seconds]
   *        The time to seek to in seconds
   *
   * @return {Player|number}
   *         - the current time in seconds when getting
   *         - a reference to the current player object when
   *           getting
   */
  currentTime(seconds) {
    if (seconds !== undefined) {

      this.techCall_('setCurrentTime', seconds);

      return this;
    }

    // cache last currentTime and return. default to 0 seconds
    //
    // Caching the currentTime is meant to prevent a massive amount of reads on the tech's
    // currentTime when scrubbing, but may not provide much performance benefit afterall.
    // Should be tested. Also something has to read the actual current time or the cache will
    // never get updated.
    this.cache_.currentTime = (this.techGet_('currentTime') || 0);
    return this.cache_.currentTime;
  }

  /**
   * Normally gets the length in time of the video in seconds;
   * in all but the rarest use cases an argument will NOT be passed to the method
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     var lengthOfVideo = myPlayer.duration();
   *   });
   * ```
   * > **NOTE**: The video must have started loading before the duration can be
   * known, and in the case of Flash, may not be known until the video starts
   * playing.
   *
   * @fires Player#durationchange
   *
   * @param {number} [seconds]
   *        The duration of the video to set in seconds
   *
   * @return {number|Player}
   *         - The duration of the video in seconds when getting
   *         - A reference to the player that called this function
   *           when setting
   */
  duration(seconds) {
    if (seconds === undefined) {
      return this.cache_.duration || 0;
    }

    seconds = parseFloat(seconds) || 0;

    // Standardize on Inifity for signaling video is live
    if (seconds < 0) {
      seconds = Infinity;
    }

    if (seconds !== this.cache_.duration) {
      // Cache the last set value for optimized scrubbing (esp. Flash)
      this.cache_.duration = seconds;

      if (seconds === Infinity) {
        this.addClass('vjs-live');
      } else {
        this.removeClass('vjs-live');
      }
      /**
       * @event Player#durationchange
       * @type {EventTarget~Event}
       */
      this.trigger('durationchange');
    }

    return this;
  }

  /**
   * Calculates how much time is left in the video. Not part
   * of the native video API.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *      myPlayer.currentTime(10);
   *
   *      // should be 10 seconds less than duration
   *      console.log(myPlayer.remainingTime());
   *   });
   * ```
   *
   * @return {number}
   *         The time remaining in seconds
   */
  remainingTime() {
    return this.duration() - this.currentTime();
  }

  //
  // Kind of like an array of portions of the video that have been downloaded.

  /**
   * Get a TimeRange object with an array of the times of the video
   * that have been downloaded. If you just want the percent of the
   * video that's been downloaded, use bufferedPercent.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     var bufferedTimeRange = myPlayer.buffered();
   *
   *     // number of different ranges of time have been buffered.
   *     // Usually 1
   *     var numberOfRanges = bufferedTimeRange.length,
   *
   *     // Time in seconds when the first range starts.
   *     // Usually 0
   *     var firstRangeStart = bufferedTimeRange.start(0),
   *
   *     // Time in seconds when the first range ends
   *     var firstRangeEnd = bufferedTimeRange.end(0),
   *
   *     // Length in seconds of the first time range
   *     var firstRangeLength = firstRangeEnd - firstRangeStart;
   *   });
   * ```
   *
   * @see [Buffered Spec]{@link http://dev.w3.org/html5/spec/video.html#dom-media-buffered}
   *
   * @return {TimeRange}
   *         A mock TimeRange object (following HTML spec)
   */
  buffered() {
    let buffered = this.techGet_('buffered');

    if (!buffered || !buffered.length) {
      buffered = createTimeRange(0, 0);
    }

    return buffered;
  }

  /**
   * Get the percent (as a decimal) of the video that's been downloaded.
   * This method is not a part of the native HTML video API.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     // example 0.11 aka 11%
   *     var howMuchIsDownloaded = myPlayer.bufferedPercent();
   *   });
   * ```
   *
   * @return {number}
   *         A decimal between 0 and 1 representing the percent
   *         that is bufferred 0 being 0% and 1 being 100%
   */
  bufferedPercent() {
    return bufferedPercent(this.buffered(), this.duration());
  }

  /**
   * Get the ending time of the last buffered time range
   * This is used in the progress bar to encapsulate all time ranges.
   *
   * @return {number}
   *         The end of the last buffered time range
   */
  bufferedEnd() {
    const buffered = this.buffered();
    const duration = this.duration();
    let end = buffered.end(buffered.length - 1);

    if (end > duration) {
      end = duration;
    }

    return end;
  }

  /**
   * Get or set the current volume of the media
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     // get
   *     var howLoudIsIt = myPlayer.volume();
   *     // set
   *     myPlayer.volume(0.5); // Set volume to half
   *   });
   * ```
   *
   * @param  {number} [percentAsDecimal]
   *         The new volume as a decimal percent:
   *         - 0 is muted/0%/off
   *         - 1.0 is 100%/full
   *         - 0.5 is half volume or 50%
   *
   * @return {Player|number}
   *         a reference to the calling player when setting and the
   *         current volume as a percent when getting
   */
  volume(percentAsDecimal) {
    let vol;

    if (percentAsDecimal !== undefined) {
      // Force value to between 0 and 1
      vol = Math.max(0, Math.min(1, parseFloat(percentAsDecimal)));
      this.cache_.volume = vol;
      this.techCall_('setVolume', vol);

      return this;
    }

    // Default to 1 when returning current volume.
    vol = parseFloat(this.techGet_('volume'));
    return (isNaN(vol)) ? 1 : vol;
  }

  /**
   * Get the current muted state, or turn mute on or off
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     // get, should be false
   *     console.log(myPlayer.muted());
   *     // set to true
   *     myPlayer.muted(true);
   *     // get should be true
   *     console.log(myPlayer.muted());
   *   });
   * ```
   *
   * @param {boolean} [muted]
   *        - true to mute
   *        - false to unmute
   *
   * @return {boolean|Player}
   *         - true if mute is on and getting
   *         - false if mute is off and getting
   *         - A reference to the current player when setting
   */
  muted(muted) {
    if (muted !== undefined) {
      this.techCall_('setMuted', muted);
      return this;
    }
    return this.techGet_('muted') || false;
  }

  /**
   * Check if current tech can support native fullscreen
   * (e.g. with built in controls like iOS, so not our flash swf)
   *
   * @return {boolean}
   *         if native fullscreen is supported
   */
  supportsFullScreen() {
    return this.techGet_('supportsFullScreen') || false;
  }

  /**
   * Check if the player is in fullscreen mode or tell the player that it
   * is or is not in fullscreen mode.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     // get, should be false
   *     console.log(myPlayer.isFullscreen());
   *
   *     // set, tell the player it's in fullscreen
   *     myPlayer.isFullscreen(true);
   *
   *     // get, should be true
   *     console.log(myPlayer.isFullscreen());
   *   });
   * ```
   * > NOTE: As of the latest HTML5 spec, isFullscreen is no longer an official
   * property and instead document.fullscreenElement is used. But isFullscreen is
   * still a valuable property for internal player workings.
   *
   * @param  {boolean} [isFS]
   *         Set the players current fullscreen state
   *
   * @return {boolean|Player}
   *         - true if fullscreen is on and getting
   *         - false if fullscreen is off and getting
   *         - A reference to the current player when setting
   */
  isFullscreen(isFS) {
    if (isFS !== undefined) {
      this.isFullscreen_ = !!isFS;
      return this;
    }
    return !!this.isFullscreen_;
  }

  /**
   * Increase the size of the video to full screen
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     myPlayer.requestFullscreen();
   *   });
   * ```
   * In some browsers, full screen is not supported natively, so it enters
   * "full window mode", where the video fills the browser window.
   * In browsers and devices that support native full screen, sometimes the
   * browser's default controls will be shown, and not the Video.js custom skin.
   * This includes most mobile devices (iOS, Android) and older versions of
   * Safari.
   *
   * @fires Player#fullscreenchange
   * @return {Player}
   *         A reference to the current player
   */
  requestFullscreen() {
    const fsApi = FullscreenApi;

    this.isFullscreen(true);

    if (fsApi.requestFullscreen) {
      // the browser supports going fullscreen at the element level so we can
      // take the controls fullscreen as well as the video

      // Trigger fullscreenchange event after change
      // We have to specifically add this each time, and remove
      // when canceling fullscreen. Otherwise if there's multiple
      // players on a page, they would all be reacting to the same fullscreen
      // events
      Events.on(document, fsApi.fullscreenchange, Fn.bind(this, function documentFullscreenChange(e) {
        this.isFullscreen(document[fsApi.fullscreenElement]);

        // If cancelling fullscreen, remove event listener.
        if (this.isFullscreen() === false) {
          Events.off(document, fsApi.fullscreenchange, documentFullscreenChange);
        }
        /**
         * @event Player#fullscreenchange
         * @type {EventTarget~Event}
         */
        this.trigger('fullscreenchange');
      }));

      this.el_[fsApi.requestFullscreen]();

    } else if (this.tech_.supportsFullScreen()) {
      // we can't take the video.js controls fullscreen but we can go fullscreen
      // with native controls
      this.techCall_('enterFullScreen');
    } else {
      // fullscreen isn't supported so we'll just stretch the video element to
      // fill the viewport
      this.enterFullWindow();
      /**
       * @event Player#fullscreenchange
       * @type {EventTarget~Event}
       */
      this.trigger('fullscreenchange');
    }

    return this;
  }

  /**
   * Return the video to its normal size after having been in full screen mode
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   *   myPlayer.ready(function() {
   *     myPlayer.requestFullscreen();
   *     myPlayer.exitFullscreen();
   *   });
   * ```
   *
   * @fires Player#fullscreenchange
   *
   * @return {Player}
   *         A reference to the current player
   */
  exitFullscreen() {
    const fsApi = FullscreenApi;

    this.isFullscreen(false);

    // Check for browser element fullscreen support
    if (fsApi.requestFullscreen) {
      document[fsApi.exitFullscreen]();
    } else if (this.tech_.supportsFullScreen()) {
      this.techCall_('exitFullScreen');
    } else {
      this.exitFullWindow();
      /**
       * @event Player#fullscreenchange
       * @type {EventTarget~Event}
       */
      this.trigger('fullscreenchange');
    }

    return this;
  }

  /**
   * When fullscreen isn't supported we can stretch the
   * video container to as wide as the browser will let us.
   *
   * @fires Player#enterFullWindow
   */
  enterFullWindow() {
    this.isFullWindow = true;

    // Storing original doc overflow value to return to when fullscreen is off
    this.docOrigOverflow = document.documentElement.style.overflow;

    // Add listener for esc key to exit fullscreen
    Events.on(document, 'keydown', Fn.bind(this, this.fullWindowOnEscKey));

    // Hide any scroll bars
    document.documentElement.style.overflow = 'hidden';

    // Apply fullscreen styles
    Dom.addElClass(document.body, 'vjs-full-window');

    /**
     * @event Player#enterFullWindow
     * @type {EventTarget~Event}
     */
    this.trigger('enterFullWindow');
  }

  /**
   * Check for call to either exit full window or
   * full screen on ESC key
   *
   * @param {string} event
   *        Event to check for key press
   */
  fullWindowOnEscKey(event) {
    if (event.keyCode === 27) {
      if (this.isFullscreen() === true) {
        this.exitFullscreen();
      } else {
        this.exitFullWindow();
      }
    }
  }

  /**
   * Exit full window
   *
   * @fires Player#exitFullWindow
   */
  exitFullWindow() {
    this.isFullWindow = false;
    Events.off(document, 'keydown', this.fullWindowOnEscKey);

    // Unhide scroll bars.
    document.documentElement.style.overflow = this.docOrigOverflow;

    // Remove fullscreen styles
    Dom.removeElClass(document.body, 'vjs-full-window');

    // Resize the box, controller, and poster to original sizes
    // this.positionAll();
    /**
     * @event Player#exitFullWindow
     * @type {EventTarget~Event}
     */
    this.trigger('exitFullWindow');
  }

  /**
   * Check whether the player can play a given mimetype
   *
   * @see https://www.w3.org/TR/2011/WD-html5-20110113/video.html#dom-navigator-canplaytype
   *
   * @param {string} type
   *        The mimetype to check
   *
   * @return {string}
   *         'probably', 'maybe', or '' (empty string)
   */
  canPlayType(type) {
    let can;

    // Loop through each playback technology in the options order
    for (let i = 0, j = this.options_.techOrder; i < j.length; i++) {
      const techName = toTitleCase(j[i]);
      let tech = Tech.getTech(techName);

      // Support old behavior of techs being registered as components.
      // Remove once that deprecated behavior is removed.
      if (!tech) {
        tech = Component.getComponent(techName);
      }

      // Check if the current tech is defined before continuing
      if (!tech) {
        log.error(`The "${techName}" tech is undefined. Skipped browser support check for that tech.`);
        continue;
      }

      // Check if the browser supports this technology
      if (tech.isSupported()) {
        can = tech.canPlayType(type);

        if (can) {
          return can;
        }
      }
    }

    return '';
  }

  /**
   * Select source based on tech-order or source-order
   * Uses source-order selection if `options.sourceOrder` is truthy. Otherwise,
   * defaults to tech-order selection
   *
   * @param {Array} sources
   *        The sources for a media asset
   *
   * @return {Object|boolean}
   *         Object of source and tech order or false
   */
  selectSource(sources) {
    // Get only the techs specified in `techOrder` that exist and are supported by the
    // current platform
    const techs =
      this.options_.techOrder
        .map(toTitleCase)
        .map((techName) => {
          // `Component.getComponent(...)` is for support of old behavior of techs
          // being registered as components.
          // Remove once that deprecated behavior is removed.
          return [techName, Tech.getTech(techName) || Component.getComponent(techName)];
        })
        .filter(([techName, tech]) => {
          // Check if the current tech is defined before continuing
          if (tech) {
            // Check if the browser supports this technology
            return tech.isSupported();
          }

          log.error(`The "${techName}" tech is undefined. Skipped browser support check for that tech.`);
          return false;
        });

    // Iterate over each `innerArray` element once per `outerArray` element and execute
    // `tester` with both. If `tester` returns a non-falsy value, exit early and return
    // that value.
    const findFirstPassingTechSourcePair = function(outerArray, innerArray, tester) {
      let found;

      outerArray.some((outerChoice) => {
        return innerArray.some((innerChoice) => {
          found = tester(outerChoice, innerChoice);

          if (found) {
            return true;
          }
        });
      });

      return found;
    };

    let foundSourceAndTech;
    const flip = (fn) => (a, b) => fn(b, a);
    const finder = ([techName, tech], source) => {
      if (tech.canPlaySource(source, this.options_[techName.toLowerCase()])) {
        return {source, tech: techName};
      }
    };

    // Depending on the truthiness of `options.sourceOrder`, we swap the order of techs and sources
    // to select from them based on their priority.
    if (this.options_.sourceOrder) {
      // Source-first ordering
      foundSourceAndTech = findFirstPassingTechSourcePair(sources, techs, flip(finder));
    } else {
      // Tech-first ordering
      foundSourceAndTech = findFirstPassingTechSourcePair(techs, sources, finder);
    }

    return foundSourceAndTech || false;
  }

  /**
   * The source function updates the video source
   * There are three types of variables you can pass as the argument.
   * **URL string**: A URL to the the video file. Use this method if you are sure
   * the current playback technology (HTML5/Flash) can support the source you
   * provide. Currently only MP4 files can be used in both HTML5 and Flash.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src("http://www.example.com/path/to/video.mp4");
   * ```
   *
   * **Source Object (or element):* * A javascript object containing information
   * about the source file. Use this method if you want the player to determine if
   * it can support the file using the type information.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src({type: "video/mp4", src: "http://www.example.com/path/to/video.mp4"});
   * ```
   *
   * **Array of Source Objects:* * To provide multiple versions of the source so
   * that it can be played using HTML5 across browsers you can use an array of
   * source objects. Video.js will detect which version is supported and load that
   * file.
   *
   * ```js
   *   var myPlayer = videojs('some-player-id');
   *
   *   myPlayer.src([
   *     {type: "video/mp4", src: "http://www.example.com/path/to/video.mp4"},
   *     {type: "video/webm", src: "http://www.example.com/path/to/video.webm"},
   *     {type: "video/ogg", src: "http://www.example.com/path/to/video.ogv"}
   *   ]);
   * ```
   *
   * @param {Tech~SourceObject|Tech~SourceObject[]} [source]
   *        One SourceObject or an array of SourceObjects
   *
   * @return {string|Player}
   *         - The current video source when getting
   *         - The player when setting
   */
  src(source) {
    if (source === undefined) {
      return this.techGet_('src');
    }

    let currentTech = Tech.getTech(this.techName_);

    // Support old behavior of techs being registered as components.
    // Remove once that deprecated behavior is removed.
    if (!currentTech) {
      currentTech = Component.getComponent(this.techName_);
    }

    // case: Array of source objects to choose from and pick the best to play
    if (Array.isArray(source)) {
      this.sourceList_(source);

    // case: URL String (http://myvideo...)
    } else if (typeof source === 'string') {
      // create a source object from the string
      this.src({ src: source });

    // case: Source object { src: '', type: '' ... }
    } else if (source instanceof Object) {
      // check if the source has a type and the loaded tech cannot play the source
      // if there's no type we'll just try the current tech
      if (source.type && !currentTech.canPlaySource(source, this.options_[this.techName_.toLowerCase()])) {
        // create a source list with the current source and send through
        // the tech loop to check for a compatible technology
        this.sourceList_([source]);
      } else {
        this.cache_.sources = null;
        this.cache_.source = source;
        this.cache_.src = source.src;

        this.currentType_ = source.type || '';

        // wait until the tech is ready to set the source
        this.ready(function() {

          // The setSource tech method was added with source handlers
          // so older techs won't support it
          // We need to check the direct prototype for the case where subclasses
          // of the tech do not support source handlers
          if (currentTech.prototype.hasOwnProperty('setSource')) {
            this.techCall_('setSource', source);
          } else {
            this.techCall_('src', source.src);
          }

          if (this.options_.preload === 'auto') {
            this.load();
          }

          if (this.options_.autoplay) {
            this.play();
          }

        // Set the source synchronously if possible (#2326)
        }, true);
      }
    }

    return this;
  }

  /**
   * Handle an array of source objects
   *
   * @param  {Tech~SourceObject[]} sources
   *         Array of source objects
   *
   * @private
   */
  sourceList_(sources) {
    const sourceTech = this.selectSource(sources);

    if (sourceTech) {
      if (sourceTech.tech === this.techName_) {
        // if this technology is already loaded, set the source
        this.src(sourceTech.source);
      } else {
        // load this technology with the chosen source
        this.loadTech_(sourceTech.tech, sourceTech.source);
      }

      this.cache_.sources = sources;
    } else {
      // We need to wrap this in a timeout to give folks a chance to add error event handlers
      this.setTimeout(function() {
        this.error({ code: 4, message: this.localize(this.options_.notSupportedMessage) });
      }, 0);

      // we could not find an appropriate tech, but let's still notify the delegate that this is it
      // this needs a better comment about why this is needed
      this.triggerReady();
    }
  }

  /**
   * Begin loading the src data.
   *
   * @return {Player}
   *         A reference to the player
   */
  load() {
    this.techCall_('load');
    return this;
  }

  /**
   * Reset the player. Loads the first tech in the techOrder,
   * and calls `reset` on the tech`.
   *
   * @return {Player}
   *         A reference to the player
   */
  reset() {
    this.loadTech_(toTitleCase(this.options_.techOrder[0]), null);
    this.techCall_('reset');
    return this;
  }

  /**
   * Returns all of the current source objects.
   *
   * @return {Tech~SourceObject[]}
   *         The current source objects
   */
  currentSources() {
    const source = this.currentSource();
    const sources = [];

    // assume `{}` or `{ src }`
    if (Object.keys(source).length !== 0) {
      sources.push(source);
    }

    return this.cache_.sources || sources;
  }

  /**
   * Returns the current source object.
   *
   * @return {Tech~SourceObject}
   *         The current source object
   */
  currentSource() {
    const source = {};
    const src = this.currentSrc();

    if (src) {
      source.src = src;
    }

    return this.cache_.source || source;
  }

  /**
   * Returns the fully qualified URL of the current source value e.g. http://mysite.com/video.mp4
   * Can be used in conjuction with `currentType` to assist in rebuilding the current source object.
   *
   * @return {string}
   *         The current source
   */
  currentSrc() {
    return this.techGet_('currentSrc') || this.cache_.src || '';
  }

  /**
   * Get the current source type e.g. video/mp4
   * This can allow you rebuild the current source object so that you could load the same
   * source and tech later
   *
   * @return {string}
   *         The source MIME type
   */
  currentType() {
    return this.currentType_ || '';
  }

  /**
   * Get or set the preload attribute
   *
   * @param {boolean} [value]
   *        - true means that we should preload
   *        - false maens that we should not preload
   *
   * @return {string|Player}
   *         - the preload attribute value when getting
   *         - the player when setting
   */
  preload(value) {
    if (value !== undefined) {
      this.techCall_('setPreload', value);
      this.options_.preload = value;
      return this;
    }
    return this.techGet_('preload');
  }

  /**
   * Get or set the autoplay attribute.
   *
   * @param {boolean} [value]
   *        - true means that we should autoplay
   *        - false maens that we should not autoplay
   *
   * @return {string|Player}
   *         - the current value of autoplay
   *         - the player when setting
   */
  autoplay(value) {
    if (value !== undefined) {
      this.techCall_('setAutoplay', value);
      this.options_.autoplay = value;
      return this;
    }
    return this.techGet_('autoplay', value);
  }

  /**
   * Get or set the loop attribute on the video element.
   *
   * @param {boolean} [value]
   *        - true means that we should loop the video
   *        - false means that we should not loop the video
   *
   * @return {string|Player}
   *         - the current value of loop when getting
   *         - the player when setting
   */
  loop(value) {
    if (value !== undefined) {
      this.techCall_('setLoop', value);
      this.options_.loop = value;
      return this;
    }
    return this.techGet_('loop');
  }

  /**
   * Get or set the poster image source url
   *
   * EXAMPLE
   * ```js
   *   var myPlayer = videojs('example_video_1');
   *
   *   // set
   *   myPlayer.poster('http://example.com/myImage.jpg');
   *
   *   // get
   *   console.log(myPlayer.poster());
   *   // 'http://example.com/myImage.jpg'
   * ```
   *
   * @fires Player#posterchange
   *
   * @param {string} [src]
   *        Poster image source URL
   *
   * @return {string|Player}
   *         - the current value of poster when getting
   *         - the player when setting
   */
  poster(src) {
    if (src === undefined) {
      return this.poster_;
    }

    // The correct way to remove a poster is to set as an empty string
    // other falsey values will throw errors
    if (!src) {
      src = '';
    }

    // update the internal poster variable
    this.poster_ = src;

    // update the tech's poster
    this.techCall_('setPoster', src);

    // alert components that the poster has been set
    /**
     * This event fires when the poster image is changed on the player.
     *
     * @event Player#posterchange
     * @type {EventTarget~Event}
     */
    this.trigger('posterchange');

    return this;
  }

  /**
   * Some techs (e.g. YouTube) can provide a poster source in an
   * asynchronous way. We want the poster component to use this
   * poster source so that it covers up the tech's controls.
   * (YouTube's play button). However we only want to use this
   * soruce if the player user hasn't set a poster through
   * the normal APIs.
   *
   * @fires Player#posterchange
   * @listens Tech#posterchange
   * @private
   */
  handleTechPosterChange_() {
    if (!this.poster_ && this.tech_ && this.tech_.poster) {
      this.poster_ = this.tech_.poster() || '';

      // Let components know the poster has changed
      this.trigger('posterchange');
    }
  }

  /**
   * Get or set whether or not the controls are showing.
   *
   * @fires Player#controlsenabled
   *
   * @param {boolean} [bool]
   *        - true to turn controls on
   *        - false to turn controls off
   *
   * @return {boolean|Player}
   *         - the current value of controls when getting
   *         - the player when setting
   */
  controls(bool) {
    if (bool !== undefined) {
      bool = !!bool;

      // Don't trigger a change event unless it actually changed
      if (this.controls_ !== bool) {
        this.controls_ = bool;

        if (this.usingNativeControls()) {
          this.techCall_('setControls', bool);
        }

        if (bool) {
          this.removeClass('vjs-controls-disabled');
          this.addClass('vjs-controls-enabled');
          /**
           * @event Player#controlsenabled
           * @type {EventTarget~Event}
           */
          this.trigger('controlsenabled');

          if (!this.usingNativeControls()) {
            this.addTechControlsListeners_();
          }
        } else {
          this.removeClass('vjs-controls-enabled');
          this.addClass('vjs-controls-disabled');
          /**
           * @event Player#controlsdisabled
           * @type {EventTarget~Event}
           */
          this.trigger('controlsdisabled');

          if (!this.usingNativeControls()) {
            this.removeTechControlsListeners_();
          }
        }
      }
      return this;
    }
    return !!this.controls_;
  }

  /**
   * Toggle native controls on/off. Native controls are the controls built into
   * devices (e.g. default iPhone controls), Flash, or other techs
   * (e.g. Vimeo Controls)
   * **This should only be set by the current tech, because only the tech knows
   * if it can support native controls**
   *
   * @fires Player#usingnativecontrols
   * @fires Player#usingcustomcontrols
   *
   * @param {boolean} [bool]
   *        - true to turn native controls on
   *        - false to turn native controls off
   *
   * @return {boolean|Player}
   *         - the current value of native controls when getting
   *         - the player when setting
   */
  usingNativeControls(bool) {
    if (bool !== undefined) {
      bool = !!bool;

      // Don't trigger a change event unless it actually changed
      if (this.usingNativeControls_ !== bool) {
        this.usingNativeControls_ = bool;
        if (bool) {
          this.addClass('vjs-using-native-controls');

          /**
           * player is using the native device controls
           *
           * @event Player#usingnativecontrols
           * @type {EventTarget~Event}
           */
          this.trigger('usingnativecontrols');
        } else {
          this.removeClass('vjs-using-native-controls');

          /**
           * player is using the custom HTML controls
           *
           * @event Player#usingcustomcontrols
           * @type {EventTarget~Event}
           */
          this.trigger('usingcustomcontrols');
        }
      }
      return this;
    }
    return !!this.usingNativeControls_;
  }

  /**
   * Set or get the current MediaError
   *
   * @fires Player#error
   *
   * @param  {MediaError|string|number} [err]
   *         A MediaError or a string/number to be turned
   *         into a MediaError
   *
   * @return {MediaError|null|Player}
   *         - The current MediaError when getting (or null)
   *         - The player when setting
   */
  error(err) {
    if (err === undefined) {
      return this.error_ || null;
    }

    // restoring to default
    if (err === null) {
      this.error_ = err;
      this.removeClass('vjs-error');
      if (this.errorDisplay) {
        this.errorDisplay.close();
      }
      return this;
    }

    this.error_ = new MediaError(err);

    // add the vjs-error classname to the player
    this.addClass('vjs-error');

    // log the name of the error type and any message
    // ie8 just logs "[object object]" if you just log the error object
    log.error(`(CODE:${this.error_.code} ${MediaError.errorTypes[this.error_.code]})`, this.error_.message, this.error_);

    /**
     * @event Player#error
     * @type {EventTarget~Event}
     */
    this.trigger('error');

    return this;
  }

  /**
   * Report user activity
   *
   * @param {Object} event
   *        Event object
   */
  reportUserActivity(event) {
    this.userActivity_ = true;
  }

  /**
   * Get/set if user is active
   *
   * @fires Player#useractive
   * @fires Player#userinactive
   *
   * @param {boolean} [bool]
   *        - true if the user is active
   *        - false if the user is inactive
   * @return {boolean|Player}
   *         - the current value of userActive when getting
   *         - the player when setting
   */
  userActive(bool) {
    if (bool !== undefined) {
      bool = !!bool;
      if (bool !== this.userActive_) {
        this.userActive_ = bool;
        if (bool) {
          // If the user was inactive and is now active we want to reset the
          // inactivity timer
          this.userActivity_ = true;
          this.removeClass('vjs-user-inactive');
          this.addClass('vjs-user-active');
          /**
           * @event Player#useractive
           * @type {EventTarget~Event}
           */
          this.trigger('useractive');
        } else {
          // We're switching the state to inactive manually, so erase any other
          // activity
          this.userActivity_ = false;

          // Chrome/Safari/IE have bugs where when you change the cursor it can
          // trigger a mousemove event. This causes an issue when you're hiding
          // the cursor when the user is inactive, and a mousemove signals user
          // activity. Making it impossible to go into inactive mode. Specifically
          // this happens in fullscreen when we really need to hide the cursor.
          //
          // When this gets resolved in ALL browsers it can be removed
          // https://code.google.com/p/chromium/issues/detail?id=103041
          if (this.tech_) {
            this.tech_.one('mousemove', function(e) {
              e.stopPropagation();
              e.preventDefault();
            });
          }

          this.removeClass('vjs-user-active');
          this.addClass('vjs-user-inactive');
          /**
           * @event Player#userinactive
           * @type {EventTarget~Event}
           */
          this.trigger('userinactive');
        }
      }
      return this;
    }
    return this.userActive_;
  }

  /**
   * Listen for user activity based on timeout value
   *
   * @private
   */
  listenForUserActivity_() {
    let mouseInProgress;
    let lastMoveX;
    let lastMoveY;
    const handleActivity = Fn.bind(this, this.reportUserActivity);

    const handleMouseMove = function(e) {
      // #1068 - Prevent mousemove spamming
      // Chrome Bug: https://code.google.com/p/chromium/issues/detail?id=366970
      if (e.screenX !== lastMoveX || e.screenY !== lastMoveY) {
        lastMoveX = e.screenX;
        lastMoveY = e.screenY;
        handleActivity();
      }
    };

    const handleMouseDown = function() {
      handleActivity();
      // For as long as the they are touching the device or have their mouse down,
      // we consider them active even if they're not moving their finger or mouse.
      // So we want to continue to update that they are active
      this.clearInterval(mouseInProgress);
      // Setting userActivity=true now and setting the interval to the same time
      // as the activityCheck interval (250) should ensure we never miss the
      // next activityCheck
      mouseInProgress = this.setInterval(handleActivity, 250);
    };

    const handleMouseUp = function(event) {
      handleActivity();
      // Stop the interval that maintains activity if the mouse/touch is down
      this.clearInterval(mouseInProgress);
    };

    // Any mouse movement will be considered user activity
    this.on('mousedown', handleMouseDown);
    this.on('mousemove', handleMouseMove);
    this.on('mouseup', handleMouseUp);

    // Listen for keyboard navigation
    // Shouldn't need to use inProgress interval because of key repeat
    this.on('keydown', handleActivity);
    this.on('keyup', handleActivity);

    // Run an interval every 250 milliseconds instead of stuffing everything into
    // the mousemove/touchmove function itself, to prevent performance degradation.
    // `this.reportUserActivity` simply sets this.userActivity_ to true, which
    // then gets picked up by this loop
    // http://ejohn.org/blog/learning-from-twitter/
    let inactivityTimeout;

    this.setInterval(function() {
      // Check to see if mouse/touch activity has happened
      if (this.userActivity_) {
        // Reset the activity tracker
        this.userActivity_ = false;

        // If the user state was inactive, set the state to active
        this.userActive(true);

        // Clear any existing inactivity timeout to start the timer over
        this.clearTimeout(inactivityTimeout);

        const timeout = this.options_.inactivityTimeout;

        if (timeout > 0) {
          // In <timeout> milliseconds, if no more activity has occurred the
          // user will be considered inactive
          inactivityTimeout = this.setTimeout(function() {
            // Protect against the case where the inactivityTimeout can trigger just
            // before the next user activity is picked up by the activity check loop
            // causing a flicker
            if (!this.userActivity_) {
              this.userActive(false);
            }
          }, timeout);
        }
      }
    }, 250);
  }

  /**
   * Gets or sets the current playback rate. A playback rate of
   * 1.0 represents normal speed and 0.5 would indicate half-speed
   * playback, for instance.
   *
   * @see https://html.spec.whatwg.org/multipage/embedded-content.html#dom-media-playbackrate
   *
   * @param {number} [rate]
   *       New playback rate to set.
   *
   * @return {number|Player}
   *         - The current playback rate when getting or 1.0
   *         - the player when setting
   */
  playbackRate(rate) {
    if (rate !== undefined) {
      this.techCall_('setPlaybackRate', rate);
      return this;
    }

    if (this.tech_ && this.tech_.featuresPlaybackRate) {
      return this.techGet_('playbackRate');
    }
    return 1.0;
  }

  /**
   * Gets or sets the audio flag
   *
   * @param {boolean} bool
   *        - true signals that this is an audio player
   *        - false signals that this is not an audio player
   *
   * @return {Player|boolean}
   *         - the current value of isAudio when getting
   *         - the player if setting
   */
  isAudio(bool) {
    if (bool !== undefined) {
      this.isAudio_ = !!bool;
      return this;
    }

    return !!this.isAudio_;
  }

  /**
   * Get the {@link VideoTrackList}
   *
   * @see https://html.spec.whatwg.org/multipage/embedded-content.html#videotracklist
   *
   * @return {VideoTrackList}
   *         the current video track list
   */
  videoTracks() {
    // if we have not yet loadTech_, we create videoTracks_
    // these will be passed to the tech during loading
    if (!this.tech_) {
      this.videoTracks_ = this.videoTracks_ || new VideoTrackList();
      return this.videoTracks_;
    }

    return this.tech_.videoTracks();
  }

  /**
   * Get the {@link AudioTrackList}
   *
   * @see https://html.spec.whatwg.org/multipage/embedded-content.html#audiotracklist
   *
   * @return {AudioTrackList}
   *         the current audio track list
   */
  audioTracks() {
    // if we have not yet loadTech_, we create videoTracks_
    // these will be passed to the tech during loading
    if (!this.tech_) {
      this.audioTracks_ = this.audioTracks_ || new AudioTrackList();
      return this.audioTracks_;
    }

    return this.tech_.audioTracks();
  }

  /**
   * Get the {@link TextTrackList}
   *
   * Text tracks are tracks of timed text events.
   * - Captions: text displayed over the video
   *             for the hearing impaired
   * - Subtitles: text displayed over the video for
   *              those who don't understand language in the video
   * - Chapters: text displayed in a menu allowing the user to jump
   *             to particular points (chapters) in the video
   * - Descriptions: (not yet implemented) audio descriptions that are read back to
   *                 the user by a screen reading device
   *
   * @see http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#dom-media-texttracks
   *
   * @return {TextTrackList|undefined}
   *         The current TextTrackList or undefined if
   *         or undefined if we don't have a tech
   */
  textTracks() {
    // cannot use techGet_ directly because it checks to see whether the tech is ready.
    // Flash is unlikely to be ready in time but textTracks should still work.
    if (this.tech_) {
      return this.tech_.textTracks();
    }
  }

  /**
   * Get the "remote" {@link TextTrackList}. Remote Text Tracks
   * are tracks that were added to the HTML video element and can
   * be removed, whereas normal texttracks cannot be removed.
   *
   *
   * @return {TextTrackList|undefined}
   *         The current remote text track list or undefined
   *         if we don't have a tech
   */
  remoteTextTracks() {
    if (this.tech_) {
      return this.tech_.remoteTextTracks();
    }
  }

  /**
   * Get the "remote" {@link HTMLTrackElementList}.
   * This gives the user all of the DOM elements that match up
   * with the remote {@link TextTrackList}.
   *
   * @return {HTMLTrackElementList}
   *         The current remote text track list elements
   *         or undefined if we don't have a tech
   */
  remoteTextTrackEls() {
    if (this.tech_) {
      return this.tech_.remoteTextTrackEls();
    }
  }

  /**
   * A helper method for adding a {@link TextTrack} to our
   * {@link TextTrackList}.
   *
   * In addition to the W3C settings we allow adding additional info through options.
   *
   * @see http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#dom-media-addtexttrack
   *
   * @param {string} [kind]
   *        the kind of TextTrack you are adding
   *
   * @param {string} [label]
   *        the label to give the TextTrack label
   *
   * @param {string} [language]
   *        the language to set on the TextTrack
   *
   * @return {TextTrack|undefined}
   *         the TextTrack that was added or undefined
   *         if there is no tech
   */
  addTextTrack(kind, label, language) {
    if (this.tech_) {
      return this.tech_.addTextTrack(kind, label, language);
    }
  }

  /**
   * Create a remote {@link TextTrack} and an {@link HTMLTrackElement}. It will
   * automatically removed from the video element whenever the source changes, unless
   * manualCleanup is set to false.
   *
   * @param {Object} options
   *        Options to pass to {@link HTMLTrackElement} during creation. See
   *        {@link HTMLTrackElement} for object properties that you should use.
   *
   * @param {boolean} [manualCleanup=true] if set to false, the TextTrack will be
   *
   * @return {HTMLTrackElement}
   *         the HTMLTrackElement that was created and added
   *         to the HTMLTrackElementList and the remote
   *         TextTrackList
   *
   * @deprecated The default value of the "manualCleanup" parameter will default
   *             to "false" in upcoming versions of Video.js
   */
  addRemoteTextTrack(options, manualCleanup) {
    if (this.tech_) {
      return this.tech_.addRemoteTextTrack(options, manualCleanup);
    }
  }

  /**
   * Remove a remote {@link TextTrack} from the respective
   * {@link TextTrackList} and {@link HTMLTrackElementList}.
   *
   * @param {Object} track
   *        Remote {@link TextTrack} to remove
   *
   * @return {undefined}
   *         does not return anything
   */
  removeRemoteTextTrack({track = arguments[0]} = {}) {
    // destructure the input into an object with a track argument, defaulting to arguments[0]
    // default the whole argument to an empty object if nothing was passed in

    if (this.tech_) {
      return this.tech_.removeRemoteTextTrack(track);
    }
  }

  /**
   * Get video width
   *
   * @return {number}
   *         current video width
   */
  videoWidth() {
    return this.tech_ && this.tech_.videoWidth && this.tech_.videoWidth() || 0;
  }

  /**
   * Get video height
   *
   * @return {number}
   *         current video height
   */
  videoHeight() {
    return this.tech_ && this.tech_.videoHeight && this.tech_.videoHeight() || 0;
  }

  // Methods to add support for
  // initialTime: function() { return this.techCall_('initialTime'); },
  // startOffsetTime: function() { return this.techCall_('startOffsetTime'); },
  // played: function() { return this.techCall_('played'); },
  // defaultPlaybackRate: function() { return this.techCall_('defaultPlaybackRate'); },
  // defaultMuted: function() { return this.techCall_('defaultMuted'); }

  /**
   * The player's language code
   * NOTE: The language should be set in the player options if you want the
   * the controls to be built with a specific language. Changing the lanugage
   * later will not update controls text.
   *
   * @param {string} [code]
   *        the language code to set the player to
   *
   * @return {string|Player}
   *         - The current language code when getting
   *         - A reference to the player when setting
   */
  language(code) {
    if (code === undefined) {
      return this.language_;
    }

    this.language_ = String(code).toLowerCase();
    return this;
  }

  /**
   * Get the player's language dictionary
   * Merge every time, because a newly added plugin might call videojs.addLanguage() at any time
   * Languages specified directly in the player options have precedence
   *
   * @return {Array}
   *         An array of of supported languages
   */
  languages() {
    return mergeOptions(Player.prototype.options_.languages, this.languages_);
  }

  /**
   * returns a JavaScript object reperesenting the current track
   * information. **DOES not return it as JSON**
   *
   * @return {Object}
   *         Object representing the current of track info
   */
  toJSON() {
    const options = mergeOptions(this.options_);
    const tracks = options.tracks;

    options.tracks = [];

    for (let i = 0; i < tracks.length; i++) {
      let track = tracks[i];

      // deep merge tracks and null out player so no circular references
      track = mergeOptions(track);
      track.player = undefined;
      options.tracks[i] = track;
    }

    return options;
  }

  /**
   * Creates a simple modal dialog (an instance of the {@link ModalDialog}
   * component) that immediately overlays the player with arbitrary
   * content and removes itself when closed.
   *
   * @param {string|Function|Element|Array|null} content
   *        Same as {@link ModalDialog#content}'s param of the same name.
   *        The most straight-forward usage is to provide a string or DOM
   *        element.
   *
   * @param {Object} [options]
   *        Extra options which will be passed on to the {@link ModalDialog}.
   *
   * @return {ModalDialog}
   *         the {@link ModalDialog} that was created
   */
  createModal(content, options) {
    options = options || {};
    options.content = content || '';

    const modal = new ModalDialog(this, options);

    this.addChild(modal);
    modal.on('dispose', () => {
      this.removeChild(modal);
    });

    return modal.open();
  }

  /**
   * Gets tag settings
   *
   * @param {Element} tag
   *        The player tag
   *
   * @return {Object}
   *         An object containing all of the settings
   *         for a player tag
   */
  static getTagSettings(tag) {
    const baseOptions = {
      sources: [],
      tracks: []
    };

    const tagOptions = Dom.getElAttributes(tag);
    const dataSetup = tagOptions['data-setup'];

    if (Dom.hasElClass(tag, 'vjs-fluid')) {
      tagOptions.fluid = true;
    }

    // Check if data-setup attr exists.
    if (dataSetup !== null) {
      // Parse options JSON
      // If empty string, make it a parsable json object.
      const [err, data] = safeParseTuple(dataSetup || '{}');

      if (err) {
        log.error(err);
      }
      assign(tagOptions, data);
    }

    assign(baseOptions, tagOptions);

    // Get tag children settings
    if (tag.hasChildNodes()) {
      const children = tag.childNodes;

      for (let i = 0, j = children.length; i < j; i++) {
        const child = children[i];
        // Change case needed: http://ejohn.org/blog/nodename-case-sensitivity/
        const childName = child.nodeName.toLowerCase();

        if (childName === 'source') {
          baseOptions.sources.push(Dom.getElAttributes(child));
        } else if (childName === 'track') {
          baseOptions.tracks.push(Dom.getElAttributes(child));
        }
      }
    }

    return baseOptions;
  }

  /**
   * Determine wether or not flexbox is supported
   *
   * @return {boolean}
   *         - true if flexbox is supported
   *         - false if flexbox is not supported
   */
  flexNotSupported_() {
    const elem = document.createElement('i');

    // Note: We don't actually use flexBasis (or flexOrder), but it's one of the more
    // common flex features that we can rely on when checking for flex support.
    return !('flexBasis' in elem.style ||
            'webkitFlexBasis' in elem.style ||
            'mozFlexBasis' in elem.style ||
            'msFlexBasis' in elem.style ||
            // IE10-specific (2012 flex spec)
            'msFlexOrder' in elem.style);
  }
}

/**
 * Global player list
 *
 * @type {Object}
 */
Player.players = {};

const navigator = window.navigator;

/*
 * Player instance options, surfaced using options
 * options = Player.prototype.options_
 * Make changes in options, not here.
 *
 * @type {Object}
 * @private
 */
Player.prototype.options_ = {
  // Default order of fallback technology
  techOrder: ['html5', 'flash'],
  // techOrder: ['flash','html5'],

  html5: {},
  flash: {},

  // defaultVolume: 0.85,
  defaultVolume: 0.00,

  // default inactivity timeout
  inactivityTimeout: 2000,

  // default playback rates
  playbackRates: [],
  // Add playback rate selection by adding rates
  // 'playbackRates': [0.5, 1, 1.5, 2],

  // Included control sets
  children: [
    'mediaLoader',
    'posterImage',
    'textTrackDisplay',
    'loadingSpinner',
    'bigPlayButton',
    'controlBar',
    'errorDisplay',
    'textTrackSettings'
  ],

  language: navigator && (navigator.languages && navigator.languages[0] || navigator.userLanguage || navigator.language) || 'en',

  // locales and their language translations
  languages: {},

  // Default message to show when a video cannot be played.
  notSupportedMessage: 'No compatible source was found for this media.'
};

[
  /**
   * Returns whether or not the player is in the "ended" state.
   *
   * @return {Boolean} True if the player is in the ended state, false if not.
   * @method Player.prototype.ended
   */
  'ended',
  /**
   * Returns whether or not the player is in the "seeking" state.
   *
   * @return {Boolean} True if the player is in the seeking state, false if not.
   * @method Player.prototype.seeking
   */
  'seeking',
  /**
   * Returns the TimeRanges of the media that are currently available
   * for seeking to.
   *
   * @return {TimeRanges} the seekable intervals of the media timeline
   * @method Player.prototype.seekable
   */
  'seekable',
  /**
   * Returns the current state of network activity for the element, from
   * the codes in the list below.
   * - NETWORK_EMPTY (numeric value 0)
   *   The element has not yet been initialised. All attributes are in
   *   their initial states.
   * - NETWORK_IDLE (numeric value 1)
   *   The element's resource selection algorithm is active and has
   *   selected a resource, but it is not actually using the network at
   *   this time.
   * - NETWORK_LOADING (numeric value 2)
   *   The user agent is actively trying to download data.
   * - NETWORK_NO_SOURCE (numeric value 3)
   *   The element's resource selection algorithm is active, but it has
   *   not yet found a resource to use.
   *
   * @see https://html.spec.whatwg.org/multipage/embedded-content.html#network-states
   * @return {number} the current network activity state
   * @method Player.prototype.networkState
   */
  'networkState',
  /**
   * Returns a value that expresses the current state of the element
   * with respect to rendering the current playback position, from the
   * codes in the list below.
   * - HAVE_NOTHING (numeric value 0)
   *   No information regarding the media resource is available.
   * - HAVE_METADATA (numeric value 1)
   *   Enough of the resource has been obtained that the duration of the
   *   resource is available.
   * - HAVE_CURRENT_DATA (numeric value 2)
   *   Data for the immediate current playback position is available.
   * - HAVE_FUTURE_DATA (numeric value 3)
   *   Data for the immediate current playback position is available, as
   *   well as enough data for the user agent to advance the current
   *   playback position in the direction of playback.
   * - HAVE_ENOUGH_DATA (numeric value 4)
   *   The user agent estimates that enough data is available for
   *   playback to proceed uninterrupted.
   *
   * @see https://html.spec.whatwg.org/multipage/embedded-content.html#dom-media-readystate
   * @return {number} the current playback rendering state
   * @method Player.prototype.readyState
   */
  'readyState'
].forEach(function(fn) {
  Player.prototype[fn] = function() {
    return this.techGet_(fn);
  };
});

TECH_EVENTS_RETRIGGER.forEach(function(event) {
  Player.prototype[`handleTech${toTitleCase(event)}_`] = function() {
    return this.trigger(event);
  };
});

/**
 * Fired when the player has initial duration and dimension information
 *
 * @event Player#loadedmetadata
 * @type {EventTarget~Event}
 */

/**
 * Fired when the player has downloaded data at the current playback position
 *
 * @event Player#loadeddata
 * @type {EventTarget~Event}
 */

/**
 * Fired when the current playback position has changed *
 * During playback this is fired every 15-250 milliseconds, depending on the
 * playback technology in use.
 *
 * @event Player#timeupdate
 * @type {EventTarget~Event}
 */

/**
 * Fired when the volume changes
 *
 * @event Player#volumechange
 * @type {EventTarget~Event}
 */

Component.registerComponent('Player', Player);
export default Player;
