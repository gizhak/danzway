print ("ready")


# Design and implement a system for agricultural monitoring and harvest management. 
# The system should track N apple trees in an orchard, where each tree has a unique sensor ID. 
# Each sensor monitors two key metrics: the total number of apples on the tree and the ripeness level of each apple (on a scale of 1-10, with 10 being fully ripe).
# The business requirement specifies that apples with a ripeness level of 7 or higher are ready for harvest. The system should provide a dashboard display that shows:
# A table of all trees with their unique IDs
# For each tree, the number of apples ready for harvest (ripeness ≥ 7)
# For each tree, the total number of apples present
# For simulation purposes, assume each tree has between 10-100 apples, with randomly assigned ripeness levels.

import random

orchard = []
apples = 8


for i in range(apples):
    tree = []

    for j in range(random.randint(10,100)):
        ripeness = random.randint(1,10)
        tree.append(ripeness)

    orchard.append(tree)

# print(orchard)


def harvest_apple(tree):
    count = 0 

    for apple in tree:
        if apple >= 7:
            count += 1
    return count

# print(harvest_apple(tree))

for i in range (len(orchard)):
    trees = orchard[i]
    ripe = harvest_apple(trees)

    print('Tire1:', i+1, len(trees), 'trees', 'has', ripe, 'harvest_apple' )