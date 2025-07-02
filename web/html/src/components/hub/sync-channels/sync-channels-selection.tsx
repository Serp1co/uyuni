import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import debounce from "lodash/debounce";
import xor from "lodash/xor";

import ChannelsFilters from "manager/content-management/shared/components/panels/sources/channels/channels-filters";
import {
  channelsFiltersAvailable,
  getInitialFiltersState,
} from "manager/content-management/shared/components/panels/sources/channels/channels-filters-state";

import { BaseChannelType, ChannelTreeType, ChildChannelType } from "core/channels/type/channels.type";

import { VirtualList } from "components/virtual-list";

import { Channel, Org } from "../types";
import SyncChannelTree from "./sync-channel-tree";
import SyncChannelProcessor from "./sync-channels-processor";

type Props = {
  channels: Channel[];
  availableOrgs: Org[];
  onChannelSelect: (channelId: number, checked: boolean) => void;
  onOrgSelect: (channelId: number, org?: Org) => void;
  loading: boolean;
  initialSelectedChannelIds?: number[]; // Track already selected channels
  channelsToAdd?: number[]; // Track pending additions
  channelsToRemove?: number[]; // Track pending removals
};

const SyncChannelsSelection = (props: Props) => {
  const [channelProcessor] = useState(new SyncChannelProcessor());
  const [allRows, setAllRows] = useState<ChannelTreeType[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set());
  const [syncedChannelIds, setSyncedChannelIds] = useState<Set<number>>(new Set());
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [activeFilters, setActiveFilters] = useState<string[]>(getInitialFiltersState());
  const [searchTerm, setSearchTerm] = useState("");

  const convertToChannelTree = useCallback((channels: Channel[]): ChannelTreeType[] => {
    const channelMap = new Map<string, Channel>();
    channels.forEach((ch) => channelMap.set(ch.channelLabel, ch));
    const rootChannels = channels.filter((ch) => !ch.parentChannelLabel);

    return rootChannels.map((root) => {
      const base: BaseChannelType = {
        id: root.channelId,
        label: root.channelLabel,
        name: root.channelName,
        custom: root.channelOrg !== null,
        archLabel: root.channelArch,
        recommendedChildren: [],
        isCloned: false, // to add the original label to the channels type
        standardizedName: root.channelName.toLowerCase(),
        recommended: false,
        subscribable: false,
      };

      const children: ChildChannelType[] = channels
        .filter((ch) => ch.parentChannelLabel === root.channelLabel)
        .map((child) => ({
          id: child.channelId,
          label: child.channelLabel,
          name: child.channelName,
          custom: child.channelOrg !== null,
          archLabel: child.channelArch,
          recommendedChildren: [],
          isCloned: false, // to add the original label to the channels type
          standardizedName: child.channelName.toLowerCase(),
          recommended: false,
          subscribable: false,
          parent: base,
        }));

      return { base, children };
    });
  }, []);

  // Apply filters and search - memoized to avoid recalculation
  const filteredRows = useMemo(() => {
    console.log("Calculating filtered rows", {
      allRows: allRows.length,
      activeFilters,
      searchTerm,
    });

    let result = [...allRows];

    // Apply channel type filters
    if (activeFilters.length > 0) {
      result = result.filter((row) => {
        // Check if this channel passes any of the active filters
        const passesFilter = activeFilters.some((filterId) => {
          const filterFn = channelsFiltersAvailable[filterId]?.isVisible;
          if (!filterFn) return false;
          const passes = filterFn(row.base);
          return passes;
        });
        return passesFilter;
      });
    }

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result
        .filter((row) => {
          const baseMatches = row.base.name.toLowerCase().includes(searchLower);
          const hasMatchingChild = row.children.some((child) => child.name.toLowerCase().includes(searchLower));
          return baseMatches || hasMatchingChild;
        })
        .map((row) => {
          // If base matches, show all children
          if (row.base.name.toLowerCase().includes(searchLower)) {
            return row;
          }
          // Otherwise, filter children
          return {
            ...row,
            children: row.children.filter((child) => child.name.toLowerCase().includes(searchLower)),
          };
        });
    }

    console.log("Filtered result:", result.length, "rows");
    return result;
  }, [allRows, activeFilters, searchTerm]);

  // Debounced search handler
  const handleSearch = useMemo(
    () =>
      debounce((value: string) => {
        console.log("Search term changed:", value);
        setSearchTerm(value);

        // Open all rows when searching
        if (value && filteredRows.length > 0) {
          setOpenRows(new Set(filteredRows.map((row) => row.base.id)));
        }
      }, 300),
    [filteredRows]
  );

  // Initialize data
  useEffect(() => {
    console.log("Initializing with channels:", props.channels.length);

    const channelTree = convertToChannelTree(props.channels);
    channelProcessor.setAvailableOrgs(props.availableOrgs);

    // Initialize sync data and track channels
    const syncedIds = new Set<number>();
    const selectedIds = new Set<number>();

    props.channels.forEach((channel) => {
      channelProcessor.setSyncData(channel.channelId, {
        synced: channel.synced,
        selectedPeripheralOrg: channel.selectedPeripheralOrg,
        strictOrg: channel.strictOrg || false,
        channelOrg: channel.channelOrg,
      });

      if (channel.synced) {
        syncedIds.add(channel.channelId);
      }

      // Initialize selected state based on current sync status and pending changes
      const isCurrentlySynced = channel.synced;
      const isPendingAddition = props.channelsToAdd?.includes(channel.channelId) || false;
      const isPendingRemoval = props.channelsToRemove?.includes(channel.channelId) || false;

      if ((isCurrentlySynced && !isPendingRemoval) || (!isCurrentlySynced && isPendingAddition)) {
        selectedIds.add(channel.channelId);
      }
    });

    setSyncedChannelIds(syncedIds);
    setSelectedChannelIds(selectedIds);
    setAllRows(channelTree); // Set unfiltered data
  }, [
    props.channels,
    props.availableOrgs,
    props.channelsToAdd,
    props.channelsToRemove,
    convertToChannelTree,
    activeFilters,
  ]);

  // Handle filter changes
  const handleFilterChange = (value: string) => {
    console.log("Filter toggled:", value);
    const newActiveFilters = xor(activeFilters, [value]);
    setActiveFilters(newActiveFilters);
    // Don't need to do anything else - filteredRows will recalculate automatically
  };

  const Row = useCallback(
    (channelTree: ChannelTreeType) => {
      console.log("Rendering row:", channelTree.base.id, channelTree.base.name);

      return (
        <SyncChannelTree
          key={channelTree.base.id}
          rowDefinition={channelTree}
          search={searchTerm}
          openRows={openRows}
          selectedRows={selectedChannelIds}
          syncedRows={syncedChannelIds}
          channelProcessor={channelProcessor}
          onToggleChannelSelect={(channel, toState) => {
            const channelId = channel.id;
            const newState = toState ?? !selectedChannelIds.has(channelId);

            const newSelectedIds = new Set(selectedChannelIds);
            if (newState) {
              newSelectedIds.add(channelId);
            } else {
              newSelectedIds.delete(channelId);
            }

            setSelectedChannelIds(newSelectedIds);
            props.onChannelSelect(channelId, newState);
          }}
          onToggleChannelOpen={(channel) => {
            const newOpenRows = new Set(openRows);
            if (newOpenRows.has(channel.id)) {
              newOpenRows.delete(channel.id);
            } else {
              newOpenRows.add(channel.id);
            }
            setOpenRows(newOpenRows);
          }}
          onOrgSelect={props.onOrgSelect}
        />
      );
    },
    [searchTerm, openRows, selectedChannelIds, syncedChannelIds, channelProcessor, props]
  );

  return (
    <div className="sync-channels-wrapper">
      <div className="row">
        <div className="col-lg-3">
          {/* Search and filters panel */}
          <div className="panel panel-default">
            <div className="panel-heading">
              <h4>{t("Filters")}</h4>
            </div>
            <div className="panel-body">
              <div className="form-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder={t("Search channels...")}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <hr />
              <ChannelsFilters activeFilters={activeFilters} onChange={handleFilterChange} />
            </div>
          </div>

          {/* Summary panel */}
          <div className="panel panel-default">
            <div className="panel-heading">
              <h4>{t("Summary")}</h4>
            </div>
            <div className="panel-body">
              <p>{t("Total channels: {count}", { count: props.channels.length })}</p>
              <p>{t("Visible: {count}", { count: filteredRows.length })}</p>
              <p>{t("Selected: {count}", { count: selectedChannelIds.size })}</p>
              <p>{t("Currently synced: {count}", { count: syncedChannelIds.size })}</p>
            </div>
          </div>
        </div>

        <div className="col-lg-9">
          {/* Channel list */}
          {props.loading ? (
            <div className="panel panel-default">
              <div className="panel-body text-center">
                <i className="fa fa-spinner fa-spin fa-2x"></i>
                <p>{t("Loading channels...")}</p>
              </div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="panel panel-default">
              <div className="panel-body text-center">
                <p>{t("No channels found.")}</p>
                {allRows.length > 0 && (
                  <p className="text-muted">
                    {t("Try adjusting filters. {count} channels are hidden.", { count: allRows.length })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="panel panel-default">
              <div className="panel-body channel-list-container">
                <VirtualList
                  items={filteredRows}
                  renderItem={Row}
                  defaultItemHeight={40}
                  itemKey={(row) => row.base.id}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncChannelsSelection;
