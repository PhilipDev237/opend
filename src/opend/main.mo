import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
import Principal "mo:base/Principal";
import NFTActorClass "../NFT/nft";
import HashMap "mo:base/HashMap";
import List "mo:base/List";
import Iter "mo:base/Iter";

actor OpenD {
    var mapOfNfts = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);
    var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);

    // create a custom data type 
    // to hold the information about the NFT
    // that is added to the listing
    private type Listing = {
        itemOwner: Principal;
        itemPrice: Nat;
    };
    
    // list of listed NFTs
    var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

    public shared(msg) func mint(imgData: [Nat8], name: Text): async Principal{
        let owner: Principal = msg.caller; // user id

        // cycles
        Debug.print(debug_show(Cycles.balance()));
        Cycles.add(100_500_000_000);
        let newNFT = await NFTActorClass.NFT(name, owner, imgData); // create new NFT instance
        Debug.print(debug_show(Cycles.balance()));

        let newNFTPrincipal = await newNFT.getCanisterId(); // canister id
        mapOfNfts.put(newNFTPrincipal, newNFT);
        addToOwnershipMap(owner, newNFTPrincipal); // update the owner's list of canisters

        return newNFTPrincipal; // return canister id
    };

    private func addToOwnershipMap(owner: Principal, nftid: Principal){
        // get the old list of canister ids owned by @owner
        // and add the new nft to the owner's list 
        var ownedNFTs: List.List<Principal> = switch(mapOfOwners.get(owner)){
            case null List.nil<Principal>(); 
            case (?result) result;
        };

        ownedNFTs := List.push(nftid, ownedNFTs);
        mapOfOwners.put(owner, ownedNFTs);
    };

    // this function returns a list of all the nfts owned by a user
    public query func getOwnedNFTs(user: Principal): async [Principal]{
        var userNFTs : List.List<Principal> = switch(mapOfOwners.get(user)){
            case null List.nil<Principal>();
            case (?result) result;
        };

        return List.toArray(userNFTs);
    };

    // the an array of listed NFTs
    public query func getListedNFTs(): async [Principal]{
        // @keys returns a list of keys
        let ids = Iter.toArray(mapOfListings.keys()); 
        return ids;
    };

    // list item for sale
    public shared(msg) func listItem(id: Principal, price: Nat) : async Text{
        var item : NFTActorClass.NFT = switch(mapOfNfts.get(id)) {
            case null return "NFT does not exist.";
            case(?result) result;
        };

        let owner = await item.getOwner();

        if(Principal.equal(owner, msg.caller)){
            let newListing : Listing = {
                itemOwner = owner;
                itemPrice = price;
            };

            // update listing
            mapOfListings.put(id, newListing);
            return "Success";
        }else{
            return "You do not own this NFT.";
        }
    };

    // return the canister id
    public query func getOpendCanisterID(): async Principal{
        return Principal.fromActor(OpenD);
    };

    // check if NFT is listed
    public query func isListed(id: Principal): async Bool{
        if(mapOfListings.get(id) == null){
            return false;
        }else{ 
            return true; 
        }
    };

    // return the original NFT owner
    public query func getOriginalOwner(id: Principal): async Principal{
        var listing: Listing = switch(mapOfListings.get(id)){
            case null return Principal.fromText("");
            case (?result) result;
        };

        return listing.itemOwner;
    };

    // return the NFT price
    public query func getNFTPrice(id: Principal): async Nat {
        var listing: Listing = switch(mapOfListings.get(id)){
            case null return 0;
            case (?result) result;
        };

        return listing.itemPrice;
    };

    // complete purchase
    public shared(msg) func completePurchase(id: Principal, ownerId: Principal, newOwnerId: Principal) : async Text{
        var purchasedNFT: NFTActorClass.NFT = switch(mapOfNfts.get(id)){
            case null return "NFT does not exist";
            case (?result) result;
        };

        let transferResult = await purchasedNFT.transferOwnership(newOwnerId);
        if(transferResult == "Success"){
            mapOfListings.delete(id);
            var ownedNFTs : List.List<Principal> = switch(mapOfOwners.get(ownerId)){
                case null List.nil<Principal>();
                case (?result) result;
            };

            ownedNFTs := List.filter(ownedNFTs, func (listItemId: Principal) : Bool {
                return listItemId != id; // return true
            });

            addToOwnershipMap(newOwnerId, id);
            return "Success";
        }else{
            return transferResult;
        }
    };
};
