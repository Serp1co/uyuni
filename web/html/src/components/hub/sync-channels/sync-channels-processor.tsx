import ChannelProcessor from "manager/content-management/shared/components/panels/sources/channels/channels-processor";

import { Org } from "../types";

export type SyncChannelData = {
  synced: boolean;
  selectedPeripheralOrg: Org | null;
  strictOrg: boolean;
  channelOrg: Org | null;
};

export default class SyncChannelProcessor extends ChannelProcessor {
  syncData: Map<number, SyncChannelData> = new Map();
  availableOrgs: Org[] = [];

  setSyncData(channelId: number, data: SyncChannelData) {
    this.syncData.set(channelId, data);
  }

  getSyncData(channelId: number): SyncChannelData | undefined {
    return this.syncData.get(channelId);
  }

  setAvailableOrgs(orgs: Org[]) {
    this.availableOrgs = orgs;
  }

  isSynced(channelId: number): boolean {
    return this.syncData.get(channelId)?.synced || false;
  }

  getSelectedOrg(channelId: number): Org | null {
    return this.syncData.get(channelId)?.selectedPeripheralOrg || null;
  }

  isVendorChannel(channelId: number): boolean {
    return this.syncData.get(channelId)?.channelOrg === null;
  }
}
